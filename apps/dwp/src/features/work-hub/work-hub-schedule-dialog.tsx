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
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

import type { WorkHubItem } from './work-hub-contracts';
import { canUseWorkHubGenericAdjunct, workHubCommandScope } from './work-hub-command-authority';
import {
  createWorkScheduleCoordinator,
  type WorkScheduleCoordinator,
} from './work-hub-schedule-coordinator';
import {
  clearWorkScheduleIntent,
  matchWorkScheduleIntent,
  persistWorkScheduleIntent,
  restoreWorkScheduleIntent,
} from './work-hub-schedule-intent-storage';
import {
  isExactWorkScheduleCommandForItem,
  type WorkScheduleCommand,
  type WorkScheduleExecutionGuard,
  type WorkScheduleResult,
} from './work-hub-scheduling';

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
  return Boolean(
    result && 'retryable' in result && result.retryable && result.reason !== 'INVALID_RECEIPT'
  );
}

function isInvalidScheduleReceipt(result: WorkScheduleResult | null) {
  return Boolean(result && 'reason' in result && result.reason === 'INVALID_RECEIPT');
}

export function WorkHubScheduleDialog({
  open,
  item,
  ownerFingerprint,
  canSchedule,
  coordinator,
  onClose,
  onOpenCalendar,
  prepare,
  execute,
}: {
  open: boolean;
  item: WorkHubItem | null;
  ownerFingerprint: string | null;
  canSchedule: boolean;
  coordinator?: WorkScheduleCoordinator;
  onClose: () => void;
  onOpenCalendar: () => void;
  prepare: (
    calendar: CalendarSummary,
    input: { startsAt: string; endsAt: string; timeZone: string; title: string }
  ) => WorkScheduleCommand;
  execute: (
    command: WorkScheduleCommand,
    confirmedEvent?: CalendarEvent,
    guard?: WorkScheduleExecutionGuard
  ) => Promise<WorkScheduleResult>;
}) {
  const { t } = useTranslation(['work', 'common']);
  const dateTimePolicy = useDateTimePolicy();
  const supported = Boolean(item && canUseWorkHubGenericAdjunct(item, 'CALENDAR'));
  const localCoordinator = useMemo(
    () => createWorkScheduleCoordinator(canSchedule ? ownerFingerprint : null),
    [canSchedule, ownerFingerprint]
  );
  useEffect(
    () => () => {
      localCoordinator.dispose();
    },
    [localCoordinator]
  );
  const scheduleStore = coordinator ?? localCoordinator;
  const calendars = useQuery({
    queryKey: ['calendar', 'calendars', 'work-schedule', ownerFingerprint],
    queryFn: ({ signal }) => getCalendars(signal),
    enabled:
      open &&
      supported &&
      canSchedule &&
      ownerFingerprint !== null &&
      scheduleStore.owner === ownerFingerprint,
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
  const activeOperation = useRef<ReturnType<WorkScheduleCoordinator['begin']>>(null);
  const activePreflight = useRef<AbortController | null>(null);
  const preflightGeneration = useRef(0);
  const [calendarId, setCalendarId] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<string | null>(range.current.startsAt);
  const [endsAt, setEndsAt] = useState<string | null>(range.current.endsAt);
  const [busy, setBusy] = useState(false);
  const [coordinatorActive, setCoordinatorActive] = useState(false);
  const [intentReady, setIntentReady] = useState(false);
  const [blockedIntentLinkId, setBlockedIntentLinkId] = useState<string | null>(null);
  const [discardingIntent, setDiscardingIntent] = useState(false);
  const [result, setResult] = useState<WorkScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initializedSelection = useRef<{
    scope: string;
    store: WorkScheduleCoordinator;
  } | null>(null);
  const itemCommandScope = item ? workHubCommandScope(item) : null;
  const currentSelection = useRef<string | null>(null);
  currentSelection.current =
    open &&
    item &&
    supported &&
    canSchedule &&
    ownerFingerprint &&
    scheduleStore.owner === ownerFingerprint
      ? `${ownerFingerprint}:${workHubCommandScope(item)}`
      : null;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      preflightGeneration.current += 1;
      activePreflight.current?.abort();
      activePreflight.current = null;
      activeOperation.current?.cancel();
      activeOperation.current = null;
    },
    [canSchedule, itemCommandScope, open, ownerFingerprint, scheduleStore]
  );

  useEffect(() => {
    if (
      !open ||
      !item ||
      !supported ||
      !canSchedule ||
      !ownerFingerprint ||
      scheduleStore.owner !== ownerFingerprint
    ) {
      initializedSelection.current = null;
      setBusy(false);
      setCoordinatorActive(false);
      setBlockedIntentLinkId(null);
      setDiscardingIntent(false);
      setResult(null);
      setError(null);
      return;
    }
    const scope = `${ownerFingerprint}:${workHubCommandScope(item)}`;
    if (
      initializedSelection.current?.scope === scope &&
      initializedSelection.current.store === scheduleStore
    )
      return;
    initializedSelection.current = { scope, store: scheduleStore };
    const recovery = scheduleStore.recover(ownerFingerprint, item.key);
    if (recovery && !isExactWorkScheduleCommandForItem(recovery.command, item)) {
      scheduleStore.clear(ownerFingerprint, item.key);
    }
    if (recovery && isExactWorkScheduleCommandForItem(recovery.command, item)) {
      const input = recovery.command.eventInput;
      range.current = { startsAt: input.startsAt, endsAt: input.endsAt };
      setCalendarId(input.calendarId ?? '');
      setTitle(input.title);
      setStartsAt(input.startsAt);
      setEndsAt(input.endsAt);
      setResult(recovery);
      setBlockedIntentLinkId(null);
      setDiscardingIntent(false);
      setError(null);
      const active = scheduleStore.isActive(ownerFingerprint, item.key);
      setBusy(active);
      setCoordinatorActive(active);
      return;
    }
    const next = initialRange();
    range.current = next;
    setTitle(item.title.slice(0, 300));
    setStartsAt(next.startsAt);
    setEndsAt(next.endsAt);
    setResult(null);
    setBlockedIntentLinkId(null);
    setDiscardingIntent(false);
    setError(null);
    setBusy(false);
    setCoordinatorActive(false);
  }, [canSchedule, item, open, ownerFingerprint, scheduleStore, supported]);
  useEffect(() => {
    if (!open || !item || !supported || !ownerFingerprint) return;
    return scheduleStore.subscribe(() => {
      const recovery = scheduleStore.recover(ownerFingerprint, item.key);
      if (!recovery || currentSelection.current === null) {
        setBusy(false);
        setCoordinatorActive(false);
        return;
      }
      if (!isExactWorkScheduleCommandForItem(recovery.command, item)) {
        scheduleStore.clear(ownerFingerprint, item.key);
        return;
      }
      const input = recovery.command.eventInput;
      range.current = { startsAt: input.startsAt, endsAt: input.endsAt };
      setCalendarId(input.calendarId ?? '');
      setTitle(input.title);
      setStartsAt(input.startsAt);
      setEndsAt(input.endsAt);
      setResult(recovery);
      setBlockedIntentLinkId(null);
      setDiscardingIntent(false);
      setError(null);
      const active = scheduleStore.isActive(ownerFingerprint, item.key);
      setBusy(active);
      setCoordinatorActive(active);
    });
  }, [item, open, ownerFingerprint, scheduleStore, supported]);
  useEffect(() => {
    let current = true;
    if (
      !open ||
      !item ||
      !supported ||
      !canSchedule ||
      !ownerFingerprint ||
      scheduleStore.owner !== ownerFingerprint
    ) {
      setIntentReady(false);
      return () => {
        current = false;
      };
    }
    const memoryRecovery = scheduleStore.recover(ownerFingerprint, item.key);
    if (memoryRecovery) {
      setIntentReady(true);
      return () => {
        current = false;
      };
    }
    setIntentReady(false);
    void restoreWorkScheduleIntent(ownerFingerprint, item.key).then(() => {
      if (
        !current ||
        currentSelection.current !== `${ownerFingerprint}:${workHubCommandScope(item)}`
      )
        return;
      setIntentReady(true);
    });
    return () => {
      current = false;
    };
  }, [canSchedule, item, open, ownerFingerprint, scheduleStore, supported]);
  useEffect(() => {
    if (!open) return;
    setCalendarId((current) => resolveScheduleCalendarId(current, editable));
  }, [editable, open]);

  if (!item || !supported) return null;
  const starts = startsAt ? Date.parse(startsAt) : Number.NaN;
  const ends = endsAt ? Date.parse(endsAt) : Number.NaN;
  const invalidRange = !Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts;
  const invalid = !calendarId || !title.trim() || title.trim().length > 300 || invalidRange;
  const completed = result?.state === 'SCHEDULED' || result?.state === 'LINK_REMOVED';
  const retryable = canRetryScheduleResult(result);
  const invalidReceipt = isInvalidScheduleReceipt(result);
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
            ? {
                severity: 'error' as const,
                key: result.reason === 'WORK_CHANGED' ? 'workChanged' : 'rejected',
              }
            : { severity: 'info' as const, key: 'linkRemoved' }
    : null;

  const submit = async () => {
    if (
      invalid ||
      busy ||
      coordinatorActive ||
      !supported ||
      !canSchedule ||
      !intentReady ||
      !ownerFingerprint ||
      scheduleStore.owner !== ownerFingerprint ||
      (result && !retryable)
    )
      return;
    const submittedSelection = `${ownerFingerprint}:${workHubCommandScope(item)}`;
    const preflightToken = ++preflightGeneration.current;
    activePreflight.current?.abort();
    const preflight = new AbortController();
    activePreflight.current = preflight;
    const preflightIsCurrent = () =>
      mounted.current &&
      !preflight.signal.aborted &&
      preflightGeneration.current === preflightToken &&
      currentSelection.current === submittedSelection &&
      scheduleStore.owner === ownerFingerprint;
    setBusy(true);
    let operation: ReturnType<WorkScheduleCoordinator['begin']> = null;
    let submittedCommand: WorkScheduleCommand | null = null;
    let submittedEvent: CalendarEvent | undefined;
    try {
      const selectedCalendar = editable.find((calendar) => calendar.calendarId === calendarId);
      if (!result && !selectedCalendar) throw new Error('Editable calendar unavailable');
      const prepared = result
        ? result.command
        : prepare(selectedCalendar!, {
            startsAt: startsAt!,
            endsAt: endsAt!,
            timeZone: dateTimePolicy.timeZone,
            title: title.trim(),
          });
      if (!isExactWorkScheduleCommandForItem(prepared, item)) {
        scheduleStore.clear(ownerFingerprint, item.key);
        return;
      }
      const storedIntent = result
        ? null
        : await matchWorkScheduleIntent(ownerFingerprint, item.key, prepared);
      if (!preflightIsCurrent()) return;
      if (storedIntent && !storedIntent.inputMatches) {
        if (mounted.current && currentSelection.current === submittedSelection) {
          setBlockedIntentLinkId(storedIntent.linkId);
          setError(t('work:workHub.schedule.previousIntentNeedsReview'));
        }
        return;
      }
      const command =
        !result && storedIntent?.inputMatches
          ? {
              ...prepared,
              linkId: storedIntent.linkId,
              eventInput: { ...prepared.eventInput, idempotencyKey: storedIntent.linkId },
            }
          : prepared;
      const confirmedEvent = result?.state === 'LINK_PENDING' ? result.event : undefined;
      submittedCommand = command;
      submittedEvent = confirmedEvent;
      if (!preflightIsCurrent()) return;
      const currentCalendars = (await getCalendars(preflight.signal)).filter(
        (candidate) => candidate.calendarId === command.eventInput.calendarId
      );
      if (!preflightIsCurrent()) return;
      const currentCalendar = currentCalendars[0];
      if (
        currentCalendars.length !== 1 ||
        !currentCalendar ||
        currentCalendar.type !== 'PERSONAL' ||
        !currentCalendar.capabilities?.canCreateEvents
      ) {
        throw new Error('Editable calendar permission changed');
      }
      operation = scheduleStore.begin(ownerFingerprint, item.key, command, confirmedEvent);
      if (!operation) return;
      if (activePreflight.current === preflight) activePreflight.current = null;
      activeOperation.current = operation;
      setCoordinatorActive(true);
      setBlockedIntentLinkId(null);
      setError(null);
      const executionCanContinue = () =>
        operation?.canContinue() === true &&
        mounted.current &&
        currentSelection.current === submittedSelection &&
        scheduleStore.owner === ownerFingerprint &&
        isExactWorkScheduleCommandForItem(command, item);
      const persisted = await persistWorkScheduleIntent(
        ownerFingerprint,
        item.key,
        command,
        window.sessionStorage,
        Date.now(),
        { signal: operation.signal, canContinue: executionCanContinue }
      );
      if (!persisted) {
        const unavailable: WorkScheduleResult = confirmedEvent
          ? {
              state: 'LINK_PENDING',
              command,
              event: confirmedEvent,
              sourceChanged: false,
              reason: 'STORAGE_UNAVAILABLE',
              retryable: true,
            }
          : {
              state: 'CALENDAR_UNCONFIRMED',
              command,
              sourceChanged: false,
              reason: 'STORAGE_UNAVAILABLE',
              retryable: true,
            };
        operation.publish(unavailable);
        if (mounted.current && currentSelection.current === submittedSelection)
          setResult(unavailable);
        return;
      }
      if (!executionCanContinue()) {
        operation.publish(
          confirmedEvent
            ? {
                state: 'LINK_PENDING',
                command,
                event: confirmedEvent,
                sourceChanged: false,
                reason: 'CANCELLED',
                retryable: true,
              }
            : {
                state: 'CALENDAR_UNCONFIRMED',
                command,
                sourceChanged: false,
                reason: 'CANCELLED',
                retryable: true,
              }
        );
        return;
      }
      const next = await execute(command, confirmedEvent, {
        signal: operation.signal,
        canContinue: executionCanContinue,
      });
      if (
        next.state === 'SCHEDULED' ||
        (next.state === 'CALENDAR_REJECTED' && next.reason !== 'INVALID_RECEIPT')
      )
        await clearWorkScheduleIntent(ownerFingerprint, item.key, command.linkId);
      const accepted = operation.publish(next);
      if (accepted && mounted.current && currentSelection.current === submittedSelection) {
        const input = next.command.eventInput;
        setCalendarId(input.calendarId ?? '');
        setTitle(input.title);
        setStartsAt(input.startsAt);
        setEndsAt(input.endsAt);
        setResult(next);
      }
    } catch {
      if (operation && submittedCommand) {
        operation.publish(
          submittedEvent
            ? {
                state: 'LINK_PENDING',
                command: submittedCommand,
                event: submittedEvent,
                sourceChanged: false,
                reason: 'UNAVAILABLE',
                retryable: true,
              }
            : {
                state: 'CALENDAR_UNCONFIRMED',
                command: submittedCommand,
                sourceChanged: false,
                reason: 'UNAVAILABLE',
                retryable: true,
              }
        );
      }
      if (mounted.current && currentSelection.current === submittedSelection)
        setError(t('work:workHub.schedule.failed'));
    } finally {
      if (activePreflight.current === preflight) activePreflight.current = null;
      if (operation && activeOperation.current === operation) activeOperation.current = null;
      if (
        mounted.current &&
        preflightGeneration.current === preflightToken &&
        currentSelection.current === submittedSelection
      )
        setBusy(false);
    }
  };

  const discardBlockedIntent = async () => {
    const discardLinkId = blockedIntentLinkId ?? (invalidReceipt ? result?.command.linkId : null);
    if (
      !discardLinkId ||
      !ownerFingerprint ||
      discardingIntent ||
      currentSelection.current !== `${ownerFingerprint}:${workHubCommandScope(item)}`
    )
      return;
    const submittedSelection = currentSelection.current;
    const linkId = discardLinkId;
    setDiscardingIntent(true);
    const cleared = await clearWorkScheduleIntent(ownerFingerprint, item.key, linkId);
    if (!mounted.current || currentSelection.current !== submittedSelection) return;
    setDiscardingIntent(false);
    if (!cleared) {
      setError(t('work:workHub.schedule.discardPreviousIntentFailed'));
      return;
    }
    if (invalidReceipt) {
      scheduleStore.clear(ownerFingerprint, item.key);
      setResult(null);
    }
    setBlockedIntentLinkId(null);
    setError(null);
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
        !canSchedule ||
        !intentReady ||
        coordinatorActive ||
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
        <Box
          sx={{
            p: 2,
            bgcolor: 'action.hover',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            borderInlineStart: 3,
            borderColor: 'primary.main',
          }}
        >
          <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 0.75 }}>
            <CalendarDays size={18} />
            <Typography variant="caption" color="text.secondary">
              {t('work:workHub.schedule.selectedWork')}
            </Typography>
          </Stack>
          <Typography variant="subtitle2">{item.title}</Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip
              size="small"
              label={t(`work:workHub.sources.${item.reference.sourceSystem}`, {
                defaultValue: t('work:workHub.sources.OTHER'),
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t(`work:workHub.lifecycle.${item.lifecycle}`)}
            />
          </Stack>
        </Box>
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
            <Stack gap={1} alignItems="flex-start">
              <span>
                {invalidReceipt
                  ? t('work:workHub.schedule.invalidReceiptNeedsReview')
                  : t(`work:workHub.schedule.results.${feedback.key}`)}
              </span>
              {invalidReceipt && (
                <ActionButton
                  intent="quiet"
                  size="small"
                  disabled={discardingIntent}
                  onClick={() => void discardBlockedIntent()}
                  sx={{ minHeight: 44 }}
                >
                  {t('work:workHub.schedule.discardPreviousIntent')}
                </ActionButton>
              )}
            </Stack>
          </InlineFeedback>
        )}
        {error && (
          <InlineFeedback severity="error">
            <Stack gap={1} alignItems="flex-start">
              <span>{error}</span>
              {blockedIntentLinkId && (
                <ActionButton
                  intent="quiet"
                  size="small"
                  disabled={discardingIntent}
                  onClick={() => void discardBlockedIntent()}
                  sx={{ minHeight: 44 }}
                >
                  {t('work:workHub.schedule.discardPreviousIntent')}
                </ActionButton>
              )}
            </Stack>
          </InlineFeedback>
        )}
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
          supportingText={t('work:workHub.schedule.titleLength', { count: title.length })}
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
        <InlineFeedback severity="info">
          {t('work:workHub.schedule.independenceNotice')}
        </InlineFeedback>
        <Typography variant="caption" color="text.secondary">
          {t('work:workHub.schedule.privateScope')}
        </Typography>
      </Stack>
    </FormDialog>
  );
}
