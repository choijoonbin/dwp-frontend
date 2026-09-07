import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ExternalLink } from 'lucide-react';
import {
  ActionButton,
  DateTimePickerField,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
  useDateTimePolicy,
} from '@dwp-frontend/design-system';
import {
  getCalendars,
  type CalendarEvent,
  type CalendarSummary,
} from '@dwp-frontend/shared-utils/api/calendar-api';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkHubItem } from './work-hub-contracts';
import type { WorkScheduleCommand, WorkScheduleResult } from './work-hub-scheduling';

function initialRange() {
  const starts = new Date();
  starts.setMinutes(starts.getMinutes() < 30 ? 30 : 60, 0, 0);
  const ends = new Date(starts.getTime() + 60 * 60_000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

export function resolveScheduleCalendarId(current: string, editable: readonly CalendarSummary[]) {
  return editable.some((calendar) => calendar.calendarId === current)
    ? current
    : (editable[0]?.calendarId ?? '');
}

export function canRetryScheduleResult(result: WorkScheduleResult | null) {
  return Boolean(result && 'retryable' in result && result.retryable);
}

function retainsCalendarReceipt(result: WorkScheduleResult) {
  return result.state === 'LINK_PENDING' || result.state === 'CALENDAR_UNCONFIRMED';
}

export function WorkHubScheduleDialog({
  open,
  item,
  onClose,
  onOpenCalendar,
  prepare,
  execute,
}: {
  open: boolean;
  item: WorkHubItem | null;
  onClose: () => void;
  onOpenCalendar: () => void;
  prepare: (
    calendar: CalendarSummary,
    input: { startsAt: string; endsAt: string; timeZone: string; title: string }
  ) => WorkScheduleCommand;
  execute: (
    command: WorkScheduleCommand,
    confirmedEvent?: CalendarEvent
  ) => Promise<WorkScheduleResult>;
}) {
  const { t } = useTranslation(['work', 'common']);
  const dateTimePolicy = useDateTimePolicy();
  const calendars = useQuery({
    queryKey: ['calendar', 'calendars', 'work-schedule'],
    queryFn: getCalendars,
    enabled: open,
    staleTime: 30_000,
    retry: 1,
    meta: { accessSensitive: true },
  });
  const editable = useMemo(
    () =>
      (calendars.data ?? []).filter(
        (calendar) => calendar.type === 'PERSONAL' && calendar.capabilities?.canCreateEvents
      ),
    [calendars.data]
  );
  const range = useRef(initialRange());
  const recoveries = useRef(new Map<string, WorkScheduleResult>());
  const [calendarId, setCalendarId] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<string | null>(range.current.startsAt);
  const [endsAt, setEndsAt] = useState<string | null>(range.current.endsAt);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WorkScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    const recovery = recoveries.current.get(item.key);
    if (recovery) {
      const input = recovery.command.eventInput;
      range.current = { startsAt: input.startsAt, endsAt: input.endsAt };
      setCalendarId(input.calendarId ?? '');
      setTitle(input.title);
      setStartsAt(input.startsAt);
      setEndsAt(input.endsAt);
      setResult(recovery);
      setError(null);
      return;
    }
    const next = initialRange();
    range.current = next;
    setTitle(item.title.slice(0, 300));
    setStartsAt(next.startsAt);
    setEndsAt(next.endsAt);
    setResult(null);
    setError(null);
  }, [item, open]);
  useEffect(() => {
    if (!open) return;
    setCalendarId((current) => resolveScheduleCalendarId(current, editable));
  }, [editable, open]);

  if (!item) return null;
  const starts = startsAt ? Date.parse(startsAt) : Number.NaN;
  const ends = endsAt ? Date.parse(endsAt) : Number.NaN;
  const invalidRange = !Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts;
  const invalid = !calendarId || !title.trim() || title.trim().length > 300 || invalidRange;
  const completed = result?.state === 'SCHEDULED' || result?.state === 'LINK_REMOVED';
  const retryable = canRetryScheduleResult(result);
  // Once a command has been executed, its reviewed calendar and event fields stay
  // immutable. Retrying must replay the same command and, when known, receipt.
  const draftLocked = Boolean(result);
  const feedback = result
    ? result.state === 'SCHEDULED'
      ? { severity: 'success' as const, key: 'scheduled' }
      : result.state === 'LINK_PENDING'
        ? { severity: 'warning' as const, key: 'linkPending' }
        : result.state === 'CALENDAR_UNCONFIRMED'
          ? { severity: 'warning' as const, key: 'unconfirmed' }
          : result.state === 'CALENDAR_REJECTED'
            ? { severity: 'error' as const, key: 'rejected' }
            : { severity: 'info' as const, key: 'linkRemoved' }
    : null;

  const submit = async () => {
    if (invalid || busy || (result && !retryable)) return;
    setBusy(true);
    setError(null);
    try {
      const selectedCalendar = editable.find((calendar) => calendar.calendarId === calendarId);
      if (!result && !selectedCalendar) throw new Error('Editable calendar unavailable');
      const command = result
        ? result.command
        : prepare(selectedCalendar!, {
            startsAt: startsAt!,
            endsAt: endsAt!,
            timeZone: dateTimePolicy.timeZone,
            title: title.trim(),
          });
      const next = await execute(
        command,
        result?.state === 'LINK_PENDING' ? result.event : undefined
      );
      if (retainsCalendarReceipt(next)) recoveries.current.set(item.key, next);
      else recoveries.current.delete(item.key);
      setResult(next);
    } catch {
      setError(t('work:workHub.schedule.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={t('work:workHub.schedule.title')}
      description={t('work:workHub.schedule.description')}
      cancelLabel={result ? t('common:actions.close') : t('common:actions.cancel')}
      submitLabel={
        result?.state === 'LINK_PENDING'
          ? t('work:workHub.schedule.retryLink')
          : result?.state === 'CALENDAR_UNCONFIRMED'
            ? t('work:workHub.schedule.recheck')
            : t('work:workHub.schedule.create')
      }
      submittingLabel={t('work:workHub.schedule.creating')}
      busy={busy}
      submitDisabled={
        invalid ||
        completed ||
        Boolean(result && !retryable) ||
        calendars.isPending ||
        !editable.length
      }
      showSubmit={!completed && (!result || retryable)}
      onClose={onClose}
      onSubmit={submit}
      mobileFullScreen
      secondaryActions={
        <ActionButton
          intent="quiet"
          startIcon={<ExternalLink size={16} />}
          onClick={onOpenCalendar}
          disabled={busy}
          sx={{ minHeight: 44 }}
        >
          {t('work:workHub.schedule.openCalendar')}
        </ActionButton>
      }
    >
      <Stack gap={2}>
        {calendars.isError && (
          <InlineFeedback severity="warning">
            {t('work:workHub.schedule.calendarUnavailable')}
          </InlineFeedback>
        )}
        {!calendars.isPending && !calendars.isError && !editable.length && (
          <InlineFeedback severity="info">
            {t('work:workHub.schedule.noEditableCalendar')}
          </InlineFeedback>
        )}
        {feedback && (
          <InlineFeedback severity={feedback.severity}>
            {t(`work:workHub.schedule.results.${feedback.key}`)}
          </InlineFeedback>
        )}
        {error && <InlineFeedback severity="error">{error}</InlineFeedback>}
        <SelectField
          label={t('work:workHub.schedule.calendar')}
          value={calendarId}
          onValueChange={(value) => {
            setCalendarId(String(value));
            setResult(null);
          }}
          options={editable.map((calendar) => ({
            value: calendar.calendarId,
            label: calendar.name,
          }))}
          disabled={calendars.isPending || busy || draftLocked}
          placeholder={t('work:workHub.schedule.chooseCalendar')}
        />
        <FormField
          label={t('work:workHub.schedule.eventTitle')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setResult(null);
          }}
          inputProps={{ maxLength: 300 }}
          disabled={busy || draftLocked}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <DateTimePickerField
            label={t('work:workHub.schedule.startsAt')}
            value={startsAt}
            onValueChange={(value) => {
              setStartsAt(value);
              setResult(null);
            }}
            disabled={busy || draftLocked}
          />
          <DateTimePickerField
            label={t('work:workHub.schedule.endsAt')}
            value={endsAt}
            onValueChange={(value) => {
              setEndsAt(value);
              setResult(null);
            }}
            errorMessage={invalidRange ? t('work:workHub.schedule.invalidRange') : undefined}
            disabled={busy || draftLocked}
          />
        </Stack>
        <Stack direction="row" gap={1} alignItems="center" color="text.secondary">
          <CalendarDays size={16} aria-hidden="true" />
          <Typography variant="caption">
            {t('work:workHub.schedule.timeZone', {
              zone: dateTimePolicy.timeZone,
            })}
          </Typography>
        </Stack>
      </Stack>
    </FormDialog>
  );
}
