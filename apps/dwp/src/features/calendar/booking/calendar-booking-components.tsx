import { useEffect, useMemo, useState } from 'react';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  boundedCalendarBookingItems,
  calendarBookingAccessInfo,
  calendarBookingAnswers,
  calendarBookingAppointmentIsMutable,
  calendarBookingHoldIssue,
  calendarBookingSlots,
  CALENDAR_BOOKING_PAGE_SIZE,
  CALENDAR_BOOKING_SEARCH_DEBOUNCE_MS,
  type CalendarBookingAnswerDraft,
} from './calendar-booking-model';

import type {
  AuthenticatedCalendarBookablePage,
  CalendarBookingAnswer,
  CalendarBookingAppointment,
  CalendarBookingAvailability,
  CalendarBookingAvailabilitySlot,
  CalendarBookingHold,
  CalendarBookingOneTimeToken,
  CalendarBookingPage,
} from '@dwp-frontend/shared-utils';
import type { CalendarBookingQueryState } from './calendar-booking-query-state';

export type CalendarBookingCopy = Readonly<{
  loading: string;
  empty: string;
  unavailable: string;
  denied: string;
  disabled: string;
  stale: string;
  partial: string;
  retry: string;
  searchLabel: string;
  searchPlaceholder: string;
  pagesLabel: string;
  noSearchResults: string;
  showMore: string;
  externalDisabled: string;
  externalEnabled: string;
  selectPage: (title: string) => string;
  pageState: (state: CalendarBookingPage['state']) => string;
  minutes: (minutes: number) => string;
  pageDetailHeading: string;
  timeZone: (value: string) => string;
  dailyLimit: (count: number) => string;
  notice: (minutes: number) => string;
  advanceWindow: (days: number) => string;
  buffers: (before: number, after: number) => string;
  availabilityRuleCount: (count: number) => string;
  questionCount: (count: number) => string;
  bookableHeading: string;
  slotsLabel: string;
  noSlots: string;
  showMoreSlots: string;
  selectSlot: (value: string) => string;
  createHold: string;
  releaseHold: string;
  holdExpired: string;
  versionChanged: string;
  accessInfoMissing: string;
  meetingMode: (mode: AuthenticatedCalendarBookablePage['meetingMode']) => string;
  accessInformation: string;
  openVideo: string;
  questionsHeading: string;
  required: string;
  answerRequired: string;
  invalidAnswer: string;
  confirmBooking: string;
  confirmReschedule: string;
  appointmentsHeading: string;
  appointmentsLabel: string;
  selectAppointment: (value: string) => string;
  appointmentState: (state: CalendarBookingAppointment['state']) => string;
  appointmentDetail: string;
  appointmentPage: string;
  appointmentTime: string;
  requestReschedule: string;
  cancelReason: string;
  cancelAppointment: string;
  actionsUnavailable: string;
  oneTimeTokenHeading: string;
  publicTokenDescription: string;
  managementTokenDescription: string;
  dismissToken: string;
}>;

type StatusProps = Readonly<{
  state: CalendarBookingQueryState;
  copy: CalendarBookingCopy;
  onRetry?: () => void;
}>;

export function CalendarBookingStatus({ state, copy, onRetry }: StatusProps) {
  if (state === 'READY' || state === 'EMPTY') return null;
  if (state === 'LOADING') return <LoadingState label={copy.loading} />;
  const message =
    state === 'DENIED'
      ? copy.denied
      : state === 'DISABLED'
        ? copy.disabled
        : state === 'STALE'
          ? copy.stale
          : state === 'PARTIAL'
            ? copy.partial
            : copy.unavailable;
  return (
    <InlineFeedback
      severity={state === 'STALE' || state === 'PARTIAL' ? 'warning' : 'error'}
      action={
        onRetry && state !== 'DENIED' && state !== 'DISABLED' ? (
          <ActionButton intent="quiet" size="small" onClick={onRetry}>
            {copy.retry}
          </ActionButton>
        ) : undefined
      }
    >
      {message}
    </InlineFeedback>
  );
}

export function CalendarBookingCapabilityNotice({
  externalEnabled,
  disabledReason,
  copy,
}: Readonly<{ externalEnabled: boolean; disabledReason?: string; copy: CalendarBookingCopy }>) {
  return (
    <Alert severity={externalEnabled ? 'info' : 'warning'} role="status">
      {externalEnabled ? copy.externalEnabled : copy.externalDisabled}
      {!externalEnabled && disabledReason ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {disabledReason}
        </Typography>
      ) : null}
    </Alert>
  );
}

export function CalendarBookingPageBrowser({
  pages,
  state,
  selectedPageId,
  copy,
  onSelect,
  onRetry,
}: Readonly<{
  pages: readonly CalendarBookingPage[];
  state: CalendarBookingQueryState;
  selectedPageId: string | null;
  copy: CalendarBookingCopy;
  onSelect: (page: CalendarBookingPage) => void;
  onRetry?: () => void;
}>) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(CALENDAR_BOOKING_PAGE_SIZE);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setQuery(draft.trim().toLocaleLowerCase()),
      CALENDAR_BOOKING_SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => setVisibleCount(CALENDAR_BOOKING_PAGE_SIZE), [query]);

  const result = useMemo(
    () =>
      boundedCalendarBookingItems(pages, visibleCount, (page) => {
        if (!query) return true;
        return `${page.title}\u0000${page.description ?? ''}`.toLocaleLowerCase().includes(query);
      }),
    [pages, query, visibleCount]
  );
  const blocked = !['READY', 'EMPTY', 'PARTIAL'].includes(state);

  return (
    <Stack spacing={1.5} component="section" aria-label={copy.pagesLabel}>
      <TextField
        size="small"
        label={copy.searchLabel}
        placeholder={copy.searchPlaceholder}
        value={draft}
        disabled={state === 'DENIED' || state === 'DISABLED'}
        onChange={(event) => setDraft(event.target.value)}
        slotProps={{ htmlInput: { type: 'search' } }}
      />
      <CalendarBookingStatus state={state} copy={copy} onRetry={onRetry} />
      {result.partial ? <InlineFeedback severity="warning">{copy.partial}</InlineFeedback> : null}
      {!blocked && state === 'EMPTY' ? (
        <Typography role="status" color="text.secondary">
          {copy.empty}
        </Typography>
      ) : null}
      {!blocked && state !== 'EMPTY' && result.items.length === 0 ? (
        <Typography role="status" color="text.secondary">
          {copy.noSearchResults}
        </Typography>
      ) : null}
      <Stack role="list" spacing={1}>
        {result.items.map((page) => (
          <Box
            role="listitem"
            key={page.pageId}
            sx={{
              border: 1,
              borderColor: selectedPageId === page.pageId ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 1.5,
              bgcolor: 'background.paper',
              '@media (forced-colors: active)': { borderColor: 'CanvasText' },
            }}
          >
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="start">
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h3" fontWeight={700} noWrap title={page.title}>
                  {page.title}
                </Typography>
                {page.description ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {page.description}
                  </Typography>
                ) : null}
              </Box>
              <Chip size="small" variant="outlined" label={copy.pageState(page.state)} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {copy.meetingMode(page.meetingMode)} · {copy.minutes(page.durationMinutes)}
            </Typography>
            <ActionButton
              intent={selectedPageId === page.pageId ? 'primary' : 'secondary'}
              size="small"
              aria-pressed={selectedPageId === page.pageId}
              aria-label={copy.selectPage(page.title)}
              onClick={() => onSelect(page)}
              sx={{ mt: 1, minHeight: 44 }}
            >
              {copy.selectPage(page.title)}
            </ActionButton>
          </Box>
        ))}
      </Stack>
      {result.hasMore ? (
        <ActionButton
          intent="quiet"
          onClick={() => setVisibleCount(result.nextVisibleCount)}
          sx={{ minHeight: 44, alignSelf: 'start' }}
        >
          {copy.showMore}
        </ActionButton>
      ) : null}
    </Stack>
  );
}

export function CalendarBookingOwnedPageDetail({
  page,
  state,
  copy,
  onRetry,
}: Readonly<{
  page: CalendarBookingPage | null;
  state: CalendarBookingQueryState;
  copy: CalendarBookingCopy;
  onRetry?: () => void;
}>) {
  if (!page) return <CalendarBookingStatus state={state} copy={copy} onRetry={onRetry} />;
  return (
    <Stack
      component="section"
      aria-labelledby="calendar-booking-owned-page-heading"
      spacing={1.25}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: { xs: 1.5, sm: 2 } }}
    >
      <CalendarBookingStatus state={state} copy={copy} onRetry={onRetry} />
      <Stack direction="row" alignItems="start" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography id="calendar-booking-owned-page-heading" component="h2" variant="h6">
            {copy.pageDetailHeading}
          </Typography>
          <Typography component="h3" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
            {page.title}
          </Typography>
        </Box>
        <Chip size="small" variant="outlined" label={copy.pageState(page.state)} />
      </Stack>
      {page.description ? <Typography color="text.secondary">{page.description}</Typography> : null}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={copy.meetingMode(page.meetingMode)} />
        <Chip size="small" label={copy.minutes(page.durationMinutes)} />
        <Chip size="small" label={copy.timeZone(page.timeZone)} />
      </Stack>
      <Typography variant="body2">{copy.dailyLimit(page.dailyLimit)}</Typography>
      <Typography variant="body2">{copy.notice(page.minimumNoticeMinutes)}</Typography>
      <Typography variant="body2">{copy.advanceWindow(page.maximumAdvanceDays)}</Typography>
      <Typography variant="body2">
        {copy.buffers(page.bufferBeforeMinutes, page.bufferAfterMinutes)}
      </Typography>
      <Typography variant="body2">
        {copy.availabilityRuleCount(page.availabilityRules.length)} ·{' '}
        {copy.questionCount(page.questions.length)}
      </Typography>
    </Stack>
  );
}

function BookingAccess({
  page,
  copy,
}: Readonly<{ page: AuthenticatedCalendarBookablePage; copy: CalendarBookingCopy }>) {
  const access = calendarBookingAccessInfo(page);
  return (
    <Box>
      <Typography component="h3" variant="subtitle2">
        {copy.accessInformation}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {copy.meetingMode(page.meetingMode)}
      </Typography>
      {!access ? (
        <InlineFeedback severity="error">{copy.accessInfoMissing}</InlineFeedback>
      ) : access.kind === 'VIDEO' ? (
        <ActionButton
          component="a"
          href={access.href}
          target="_blank"
          rel="noopener noreferrer"
          intent="secondary"
          size="small"
          sx={{ mt: 0.75, minHeight: 44 }}
        >
          {copy.openVideo}
        </ActionButton>
      ) : (
        <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {access.text}
        </Typography>
      )}
    </Box>
  );
}

function slotValue(slot: CalendarBookingAvailabilitySlot) {
  return JSON.stringify([slot.startsAt, slot.endsAt]);
}

function QuestionFields({
  page,
  draft,
  copy,
  disabled,
  onChange,
}: Readonly<{
  page: AuthenticatedCalendarBookablePage;
  draft: CalendarBookingAnswerDraft;
  copy: CalendarBookingCopy;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}>) {
  const validation = calendarBookingAnswers(page.questions, draft);
  return (
    <Stack spacing={1.25} component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
      <Typography component="legend" variant="subtitle1" fontWeight={700}>
        {copy.questionsHeading}
      </Typography>
      {page.questions.map((question) => {
        const error = validation.issues[question.key];
        const label = `${question.label}${question.required ? ` (${copy.required})` : ''}`;
        if (question.type === 'CHECKBOX') {
          return (
            <FormControl key={question.key} error={Boolean(error)} disabled={disabled}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={draft[question.key] === 'true'}
                    onChange={(event) => onChange(question.key, event.target.checked ? 'true' : '')}
                  />
                }
                label={label}
                sx={{ minHeight: 44 }}
              />
              {error ? (
                <Typography variant="caption" color="error" role="alert">
                  {error === 'REQUIRED_ANSWER_MISSING' ? copy.answerRequired : copy.invalidAnswer}
                </Typography>
              ) : null}
            </FormControl>
          );
        }
        if (question.type === 'SINGLE_SELECT') {
          const labelId = `calendar-booking-question-${question.key}`;
          return (
            <FormControl key={question.key} error={Boolean(error)} disabled={disabled}>
              <FormLabel id={labelId}>{label}</FormLabel>
              <RadioGroup
                aria-labelledby={labelId}
                value={draft[question.key] ?? ''}
                onChange={(event) => onChange(question.key, event.target.value)}
              >
                {(question.options ?? []).map((option) => (
                  <FormControlLabel
                    key={option}
                    value={option}
                    control={<Radio />}
                    label={option}
                  />
                ))}
              </RadioGroup>
              {error ? (
                <Typography variant="caption" color="error" role="alert">
                  {error === 'REQUIRED_ANSWER_MISSING' ? copy.answerRequired : copy.invalidAnswer}
                </Typography>
              ) : null}
            </FormControl>
          );
        }
        return (
          <TextField
            key={question.key}
            label={label}
            value={draft[question.key] ?? ''}
            multiline={question.type === 'LONG_TEXT'}
            minRows={question.type === 'LONG_TEXT' ? 3 : undefined}
            disabled={disabled}
            error={Boolean(error)}
            helperText={
              error
                ? error === 'REQUIRED_ANSWER_MISSING'
                  ? copy.answerRequired
                  : copy.invalidAnswer
                : undefined
            }
            onChange={(event) => onChange(question.key, event.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
        );
      })}
    </Stack>
  );
}

export function CalendarBookingBookablePanel({
  page,
  availability,
  state,
  selectedSlot,
  hold,
  heldPageVersion,
  answers,
  purpose = 'BOOK',
  locale = 'en',
  busy = false,
  now = Date.now(),
  copy,
  onSelectSlot,
  onCreateHold,
  onReleaseHold,
  onAnswer,
  onConfirm,
  onRetry,
}: Readonly<{
  page: AuthenticatedCalendarBookablePage | null;
  availability: CalendarBookingAvailability | null;
  state: CalendarBookingQueryState;
  selectedSlot: CalendarBookingAvailabilitySlot | null;
  hold: CalendarBookingHold | null;
  heldPageVersion: number | null;
  answers: CalendarBookingAnswerDraft;
  purpose?: 'BOOK' | 'RESCHEDULE';
  locale?: string;
  busy?: boolean;
  now?: number;
  copy: CalendarBookingCopy;
  onSelectSlot: (slot: CalendarBookingAvailabilitySlot) => void;
  onCreateHold: (slot: CalendarBookingAvailabilitySlot, pageVersion: number) => void;
  onReleaseHold: (hold: CalendarBookingHold) => void;
  onAnswer: (key: string, value: string) => void;
  onConfirm: (answers: readonly CalendarBookingAnswer[], hold: CalendarBookingHold) => void;
  onRetry?: () => void;
}>) {
  const slots = useMemo(
    () =>
      page && availability
        ? calendarBookingSlots(availability, page.pageId, page.pageVersion, now)
        : [],
    [availability, now, page]
  );
  const [visibleSlotCount, setVisibleSlotCount] = useState(CALENDAR_BOOKING_PAGE_SIZE);
  useEffect(
    () => setVisibleSlotCount(CALENDAR_BOOKING_PAGE_SIZE),
    [availability?.generatedAt, page?.pageId, page?.pageVersion]
  );
  const slotResult = useMemo(
    () => boundedCalendarBookingItems(slots, visibleSlotCount),
    [slots, visibleSlotCount]
  );
  const access = page ? calendarBookingAccessInfo(page) : null;
  const holdIssue =
    page && hold && heldPageVersion !== null
      ? calendarBookingHoldIssue(hold, heldPageVersion, page.pageVersion, now, page.pageId)
      : null;
  const validation = page ? calendarBookingAnswers(page.questions, answers) : null;
  const mutationReady = state === 'READY' && Boolean(access) && !busy;
  const activeSelectedSlot = selectedSlot
    ? (slotResult.items.find(
        (slot) => slot.startsAt === selectedSlot.startsAt && slot.endsAt === selectedSlot.endsAt
      ) ?? null)
    : null;

  if (!page) return <CalendarBookingStatus state={state} copy={copy} onRetry={onRetry} />;

  return (
    <Stack
      component="section"
      aria-labelledby="calendar-booking-bookable-heading"
      spacing={2}
      sx={{ minWidth: 0 }}
    >
      <Box>
        <Typography id="calendar-booking-bookable-heading" component="h2" variant="h6">
          {copy.bookableHeading}
        </Typography>
        <Typography component="h3" variant="subtitle1" fontWeight={700}>
          {page.title}
        </Typography>
        {page.description ? (
          <Typography color="text.secondary">{page.description}</Typography>
        ) : null}
      </Box>
      <CalendarBookingStatus state={state} copy={copy} onRetry={onRetry} />
      <BookingAccess page={page} copy={copy} />
      {!hold ? (
        <FormControl component="fieldset" disabled={!mutationReady || slots.length === 0}>
          <FormLabel id="calendar-booking-slots-label" component="legend">
            {copy.slotsLabel}
          </FormLabel>
          {slots.length === 0 ? (
            <Typography color="text.secondary" role="status" sx={{ mt: 1 }}>
              {copy.noSlots}
            </Typography>
          ) : (
            <RadioGroup
              aria-labelledby="calendar-booking-slots-label"
              value={activeSelectedSlot ? slotValue(activeSelectedSlot) : ''}
              onChange={(event) => {
                const slot = slots.find((item) => slotValue(item) === event.target.value);
                if (slot) onSelectSlot(slot);
              }}
            >
              {slotResult.items.map((slot) => {
                const value = slotValue(slot);
                const start = formatAppointment(slot.startsAt, locale, page.timeZone);
                const end = formatAppointment(slot.endsAt, locale, page.timeZone);
                return (
                  <FormControlLabel
                    key={value}
                    value={value}
                    control={<Radio />}
                    label={copy.selectSlot(`${start} – ${end}`)}
                    sx={{ minHeight: 44 }}
                  />
                );
              })}
            </RadioGroup>
          )}
          {slotResult.partial ? (
            <InlineFeedback severity="warning">{copy.partial}</InlineFeedback>
          ) : null}
          {slotResult.hasMore ? (
            <ActionButton
              intent="quiet"
              disabled={!mutationReady}
              onClick={() => setVisibleSlotCount(slotResult.nextVisibleCount)}
              sx={{ minHeight: 44, alignSelf: 'start' }}
            >
              {copy.showMoreSlots}
            </ActionButton>
          ) : null}
          <ActionButton
            intent="primary"
            disabled={!mutationReady || !activeSelectedSlot}
            onClick={() => {
              if (activeSelectedSlot) onCreateHold(activeSelectedSlot, page.pageVersion);
            }}
            sx={{ mt: 1, minHeight: 44, alignSelf: 'start' }}
          >
            {copy.createHold}
          </ActionButton>
        </FormControl>
      ) : holdIssue ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => onReleaseHold(hold)}>
              {copy.releaseHold}
            </ActionButton>
          }
        >
          {holdIssue === 'HOLD_EXPIRED' ? copy.holdExpired : copy.versionChanged}
        </InlineFeedback>
      ) : (
        <Stack spacing={1.5}>
          {purpose === 'BOOK' ? (
            <QuestionFields
              page={page}
              draft={answers}
              copy={copy}
              disabled={!mutationReady}
              onChange={onAnswer}
            />
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <ActionButton
              intent="primary"
              disabled={
                !mutationReady ||
                (purpose === 'BOOK' && Boolean(validation && Object.keys(validation.issues).length))
              }
              onClick={() => onConfirm(validation?.answers ?? [], hold)}
              sx={{ minHeight: 44 }}
            >
              {purpose === 'BOOK' ? copy.confirmBooking : copy.confirmReschedule}
            </ActionButton>
            <ActionButton
              intent="secondary"
              disabled={busy}
              onClick={() => onReleaseHold(hold)}
              sx={{ minHeight: 44 }}
            >
              {copy.releaseHold}
            </ActionButton>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function formatAppointment(value: string, locale: string, timeZone: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return formatDate(
    parsed,
    { dateStyle: 'medium', timeStyle: 'short', timeZone },
    resolveSupportedLocale(locale)
  );
}

export function CalendarBookingAppointments({
  appointments,
  state,
  actionState = state,
  selectedAppointmentId,
  locale,
  timeZone,
  copy,
  busy = false,
  now = Date.now(),
  onSelect,
  onRequestReschedule,
  onCancel,
  onRetry,
}: Readonly<{
  appointments: readonly CalendarBookingAppointment[];
  state: CalendarBookingQueryState;
  actionState?: CalendarBookingQueryState;
  selectedAppointmentId: string | null;
  locale: string;
  timeZone: string;
  copy: CalendarBookingCopy;
  busy?: boolean;
  now?: number;
  onSelect: (appointment: CalendarBookingAppointment) => void;
  onRequestReschedule: (appointment: CalendarBookingAppointment) => void;
  onCancel: (input: { appointmentId: string; version: number; reason: string | null }) => void;
  onRetry?: () => void;
}>) {
  const [reason, setReason] = useState('');
  const selected = appointments.find(
    (appointment) => appointment.appointmentId === selectedAppointmentId
  );
  const mutable = Boolean(selected && calendarBookingAppointmentIsMutable(selected, now));
  const actionsEnabled = actionState === 'READY' && mutable && !busy;

  useEffect(() => setReason(''), [selectedAppointmentId]);

  return (
    <Stack component="section" aria-labelledby="calendar-booking-appointments-heading" spacing={2}>
      <Typography id="calendar-booking-appointments-heading" component="h2" variant="h6">
        {copy.appointmentsHeading}
      </Typography>
      <CalendarBookingStatus state={state} copy={copy} onRetry={onRetry} />
      {state === 'EMPTY' ? (
        <Typography role="status" color="text.secondary">
          {copy.empty}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(240px, 0.8fr) minmax(0, 1.2fr)',
          },
          gap: 2,
        }}
      >
        <Stack role="list" aria-label={copy.appointmentsLabel} spacing={1}>
          {appointments.map((appointment) => {
            const label = formatAppointment(appointment.startsAt, locale, timeZone);
            return (
              <Box key={appointment.appointmentId} role="listitem">
                <ActionButton
                  fullWidth
                  intent={
                    selectedAppointmentId === appointment.appointmentId ? 'primary' : 'secondary'
                  }
                  aria-pressed={selectedAppointmentId === appointment.appointmentId}
                  aria-label={copy.selectAppointment(label)}
                  onClick={() => onSelect(appointment)}
                  sx={{ minHeight: 44, justifyContent: 'space-between', whiteSpace: 'normal' }}
                >
                  <span>{label}</span>
                  <span>{copy.appointmentState(appointment.state)}</span>
                </ActionButton>
              </Box>
            );
          })}
        </Stack>
        {selected ? (
          <Stack
            spacing={1.25}
            aria-live="polite"
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: { xs: 1.5, sm: 2 } }}
          >
            <Typography component="h3" variant="subtitle1" fontWeight={700}>
              {copy.appointmentDetail}
            </Typography>
            <Typography>
              {copy.appointmentTime}: {formatAppointment(selected.startsAt, locale, timeZone)}
            </Typography>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {copy.appointmentPage}: {selected.pageId}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={copy.appointmentState(selected.state)}
              sx={{ alignSelf: 'start' }}
            />
            <Divider />
            {!actionsEnabled ? (
              <Typography role="status" color="text.secondary">
                {copy.actionsUnavailable}
              </Typography>
            ) : null}
            <TextField
              label={copy.cancelReason}
              value={reason}
              disabled={!actionsEnabled}
              multiline
              minRows={2}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <ActionButton
                intent="secondary"
                disabled={!actionsEnabled}
                onClick={() => onRequestReschedule(selected)}
                sx={{ minHeight: 44 }}
              >
                {copy.requestReschedule}
              </ActionButton>
              <ActionButton
                intent="danger"
                disabled={!actionsEnabled}
                onClick={() =>
                  onCancel({
                    appointmentId: selected.appointmentId,
                    version: selected.version,
                    reason: reason.trim() || null,
                  })
                }
                sx={{ minHeight: 44 }}
              >
                {copy.cancelAppointment}
              </ActionButton>
            </Stack>
          </Stack>
        ) : null}
      </Box>
    </Stack>
  );
}

export function CalendarBookingOneTimeTokenNotice({
  token,
  copy,
  onDismiss,
}: Readonly<{
  token: CalendarBookingOneTimeToken;
  copy: CalendarBookingCopy;
  onDismiss: () => void;
}>) {
  return (
    <Alert
      severity="warning"
      role="status"
      action={
        <ActionButton intent="quiet" size="small" onClick={onDismiss}>
          {copy.dismissToken}
        </ActionButton>
      }
      sx={{
        '& code': { overflowWrap: 'anywhere', userSelect: 'all' },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Typography component="h3" variant="subtitle2">
        {copy.oneTimeTokenHeading}
      </Typography>
      <Typography variant="body2">
        {token.kind === 'PUBLIC_LINK'
          ? copy.publicTokenDescription
          : copy.managementTokenDescription}
      </Typography>
      <Box component="code" sx={{ display: 'block', mt: 0.75 }}>
        {token.value}
      </Box>
    </Alert>
  );
}
