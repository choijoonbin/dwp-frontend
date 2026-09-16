import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useDateTimePolicy } from '@dwp-frontend/design-system';
import {
  getCalendars,
  type CalendarEvent,
  type CalendarSummary,
} from '@dwp-frontend/shared-utils/api/calendar-api';

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
  createWorkScheduleDraft,
  isExactWorkScheduleCommandForItem,
  type WorkScheduleCommand,
  type WorkScheduleDraftInput,
  type WorkScheduleExecutionGuard,
  type WorkScheduleResult,
} from './work-hub-scheduling';
import { WorkHubScheduleDialogFrame } from './work-hub-schedule-dialog-frame';
import { WorkHubScheduleDialogContent } from './work-hub-schedule-dialog-content';

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
  plannedForToday = false,
  ownerFingerprint,
  canSchedule,
  coordinator,
  onClose,
  onOpenCalendar,
  reviewHandoff,
  prepare,
  execute,
}: {
  open: boolean;
  item: WorkHubItem | null;
  plannedForToday?: boolean;
  ownerFingerprint: string | null;
  canSchedule: boolean;
  coordinator?: WorkScheduleCoordinator;
  onClose: () => void;
  onOpenCalendar: (draft: WorkScheduleDraftInput) => void | Promise<void>;
  reviewHandoff: (item: WorkHubItem, guard: WorkScheduleExecutionGuard) => Promise<boolean>;
  prepare: (calendar: CalendarSummary, input: WorkScheduleDraftInput) => WorkScheduleCommand;
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
  const [bootstrapDraft] = useState(() =>
    createWorkScheduleDraft({
      title: t('work:workHub.schedule.defaultTitle', { title: item?.title ?? '' }),
      timeZone: dateTimePolicy.timeZone,
    })
  );
  const range = useRef({
    startsAt: bootstrapDraft.startsAt,
    endsAt: bootstrapDraft.endsAt,
  });
  const activeOperation = useRef<ReturnType<WorkScheduleCoordinator['begin']>>(null);
  const activePreflight = useRef<AbortController | null>(null);
  const preflightGeneration = useRef(0);
  const [calendarId, setCalendarId] = useState('');
  const [title, setTitle] = useState(bootstrapDraft.title);
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
    const next = createWorkScheduleDraft({
      title: t('work:workHub.schedule.defaultTitle', { title: item.title }),
      timeZone: dateTimePolicy.timeZone,
    });
    range.current = { startsAt: next.startsAt, endsAt: next.endsAt };
    setTitle(next.title);
    setStartsAt(next.startsAt);
    setEndsAt(next.endsAt);
    setResult(null);
    setBlockedIntentLinkId(null);
    setDiscardingIntent(false);
    setError(null);
    setBusy(false);
    setCoordinatorActive(false);
  }, [
    canSchedule,
    dateTimePolicy.timeZone,
    item,
    open,
    ownerFingerprint,
    scheduleStore,
    supported,
    t,
  ]);
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
  const handoffInvalid = !title.trim() || title.trim().length > 300 || invalidRange;
  const invalid = !calendarId || handoffInvalid;
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

  const durationMinutes =
    Number.isFinite(starts) && Number.isFinite(ends) && ends > starts
      ? Math.round((ends - starts) / 60_000)
      : null;
  const submitDisabled =
    invalid ||
    completed ||
    Boolean(result && !retryable) ||
    !canSchedule ||
    !intentReady ||
    coordinatorActive ||
    calendars.isPending ||
    !editable.length;
  const showSubmit = !completed && (!result || retryable);
  const readinessState = busy
    ? 'preparing'
    : calendars.isPending || !intentReady
      ? 'checking'
      : invalid ||
          calendars.isError ||
          !editable.length ||
          Boolean(error) ||
          Boolean(result && !completed)
        ? 'attention'
        : completed
          ? 'completed'
          : 'ready';

  const handoff = async () => {
    if (
      handoffInvalid ||
      busy ||
      !startsAt ||
      !endsAt ||
      !canSchedule ||
      !ownerFingerprint ||
      scheduleStore.owner !== ownerFingerprint
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
    setError(null);
    try {
      const ready = await reviewHandoff(item, {
        signal: preflight.signal,
        canContinue: preflightIsCurrent,
      });
      if (!preflightIsCurrent()) return;
      if (!ready) {
        setError(t('work:workHub.schedule.results.workChanged'));
        return;
      }
      await onOpenCalendar({
        title: title.trim(),
        startsAt,
        endsAt,
        timeZone: dateTimePolicy.timeZone,
      });
    } catch (handoffError) {
      if (!(handoffError instanceof DOMException && handoffError.name === 'AbortError'))
        setError(t('work:workHub.schedule.results.workChanged'));
    } finally {
      if (activePreflight.current === preflight) activePreflight.current = null;
      if (preflightIsCurrent()) setBusy(false);
    }
  };

  return (
    <WorkHubScheduleDialogFrame
      open={open}
      serviceCode={t('work:workHub.schedule.serviceCode')}
      serviceName={t('work:workHub.schedule.serviceName')}
      title={t('work:workHub.schedule.title')}
      subtitle={t('work:workHub.schedule.subtitle')}
      description={t('work:workHub.schedule.description')}
      closeLabel={t('common:actions.close')}
      cancelLabel={result ? t('common:actions.close') : t('common:actions.cancel')}
      submitLabel={
        result?.state === 'LINK_PENDING'
          ? t('work:workHub.schedule.retryLink')
          : result?.state === 'CALENDAR_UNCONFIRMED'
            ? t('work:workHub.schedule.recheck')
            : t('work:workHub.schedule.create')
      }
      submittingLabel={t('work:workHub.schedule.creating')}
      secondaryActionLabel={t('work:workHub.schedule.openCalendar')}
      secondaryActionDisabled={handoffInvalid || busy || !canSchedule}
      busy={busy}
      submitDisabled={submitDisabled}
      showSubmit={showSubmit}
      onClose={onClose}
      onSubmit={submit}
      onSecondaryAction={() => void handoff()}
    >
      <WorkHubScheduleDialogContent
        item={item}
        plannedForToday={plannedForToday}
        calendarsError={calendars.isError}
        calendarsPending={calendars.isPending}
        editable={editable}
        feedback={feedback}
        invalidReceipt={invalidReceipt}
        discardingIntent={discardingIntent}
        onDiscardIntent={() => void discardBlockedIntent()}
        error={error}
        blockedIntent={Boolean(blockedIntentLinkId)}
        calendarId={calendarId}
        onCalendarChange={(nextCalendarId) => {
          setCalendarId(nextCalendarId);
          setResult(null);
        }}
        title={title}
        onTitleChange={(nextTitle) => {
          setTitle(nextTitle);
          setResult(null);
        }}
        busy={busy}
        draftLocked={draftLocked}
        startsAt={startsAt}
        onStartsAtChange={(value) => {
          setStartsAt(value);
          setResult(null);
        }}
        endsAt={endsAt}
        onEndsAtChange={(value) => {
          setEndsAt(value);
          setResult(null);
        }}
        invalidRange={invalidRange}
        durationMinutes={durationMinutes}
        timeZone={dateTimePolicy.timeZone}
        readinessState={readinessState}
      />
    </WorkHubScheduleDialogFrame>
  );
}
