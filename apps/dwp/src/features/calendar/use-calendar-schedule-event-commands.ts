import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  cancelCalendarEvent,
  respondToCalendarEvent,
  trashCalendarEvent,
  updateCalendarEvent,
  updateCalendarEventPreference,
  useToast,
  type CalendarEvent,
} from '@dwp-frontend/shared-utils';

import { calendarScheduleMoveInput } from './calendar-schedule-event-move';
import {
  completeCalendarResponseIntent,
  prepareCalendarResponseCommand,
  type CalendarResponseIntent,
} from './calendar-response-intent';
import { eventCapability } from './calendar-source-model';

type CalendarScheduleEventCommandsInput = Readonly<{
  canUpdate: boolean;
  responseIntentRef: MutableRefObject<CalendarResponseIntent | null>;
  setSelected: Dispatch<SetStateAction<CalendarEvent | null>>;
  setCancelling: Dispatch<SetStateAction<CalendarEvent | null>>;
  setTrashing: Dispatch<SetStateAction<CalendarEvent | null>>;
}>;

export function useCalendarScheduleEventCommands({
  canUpdate,
  responseIntentRef,
  setSelected,
  setCancelling,
  setTrashing,
}: CalendarScheduleEventCommandsInput) {
  const { t } = useTranslation('calendar');
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const requestedEventId = new URLSearchParams(location.search).get('event');

  const clearEventSelection = useCallback(() => {
    setSelected(null);
    if (!requestedEventId) return;
    const next = new URLSearchParams(location.search);
    next.delete('event');
    setSearchParams(next, { replace: true });
  }, [location.search, requestedEventId, setSearchParams, setSelected]);

  const respondMutation = useMutation({
    mutationFn: ({
      eventId,
      response,
      expectedVersion,
      idempotencyKey,
    }: ReturnType<typeof prepareCalendarResponseCommand>['command']) =>
      respondToCalendarEvent(eventId, response, expectedVersion, idempotencyKey),
    onSuccess: async (event, command) => {
      responseIntentRef.current = completeCalendarResponseIntent(
        responseIntentRef.current,
        command.idempotencyKey
      );
      setSelected(event);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.responseSaved'));
    },
    onError: () => toast.error(t('event.responseError')),
  });
  const cancelMutation = useMutation({
    mutationFn: (event: CalendarEvent) => cancelCalendarEvent(event.eventId, event.version),
    onSuccess: async () => {
      clearEventSelection();
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.cancelled'));
    },
    onError: () => toast.error(t('event.cancelError')),
  });
  const trashMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      trashCalendarEvent(event.eventId, event.version, t('event.userDeletionReason')),
    onSuccess: async () => {
      clearEventSelection();
      setTrashing(null);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('event.trashed'));
    },
    onError: () => toast.error(t('event.trashError')),
  });
  const preferenceMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      updateCalendarEventPreference(event.eventId, {
        starred: !event.starred,
        hidden: false,
        version: event.preferenceVersion ?? 0,
      }),
    onSuccess: async (preference, event) => {
      setSelected((current) =>
        current?.eventId === event.eventId
          ? {
              ...current,
              starred: preference.starred,
              preferenceVersion: preference.version,
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
      toast.success(t(preference.starred ? 'event.starred' : 'event.unstarred'));
    },
    onError: () => toast.error(t('event.starError')),
  });
  const moveMutation = useMutation({
    mutationFn: async ({
      event,
      change,
    }: {
      event: CalendarEvent;
      change: Readonly<{ startsAt: string; endsAt: string; allDay: boolean }>;
      revert: () => void;
    }) => updateCalendarEvent(event.eventId, calendarScheduleMoveInput(event, change)),
    onSuccess: async (saved) => {
      setSelected((current) => (current?.eventId === saved.eventId ? saved : current));
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(t('schedule.moveSuccess'));
    },
    onError: (_error, variables) => {
      variables.revert();
      toast.error(t('schedule.moveError'));
    },
  });

  const canManage = useCallback(
    (event: CalendarEvent) =>
      canUpdate && event.status !== 'CANCELLED' && eventCapability(event, 'canEdit'),
    [canUpdate]
  );
  const canDelete = useCallback(
    (event: CalendarEvent) =>
      canUpdate && event.status !== 'CANCELLED' && eventCapability(event, 'canDelete'),
    [canUpdate]
  );
  const canMove = useCallback(
    (event: CalendarEvent) =>
      !moveMutation.isPending && canManage(event) && event.recurrence === 'NONE',
    [canManage, moveMutation.isPending]
  );
  const respond = (event: CalendarEvent, response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') => {
    const prepared = prepareCalendarResponseCommand(responseIntentRef.current, event, response);
    responseIntentRef.current = prepared.intent;
    respondMutation.mutate(prepared.command);
  };

  return {
    cancelMutation,
    canDelete,
    canManage,
    canMove,
    clearEventSelection,
    moveMutation,
    preferenceMutation,
    respond,
    trashMutation,
  };
}
