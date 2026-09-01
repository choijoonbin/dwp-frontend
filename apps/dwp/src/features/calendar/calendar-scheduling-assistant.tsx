import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CalendarSearch, Check, LockKeyhole, Sparkles, UsersRound } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system';
import { evaluateCalendarScheduling } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { calendarDate, calendarTime } from './calendar-components';
import {
  applyCalendarAvailabilitySlot,
  calendarAvailabilityWindow,
  calendarMeetingDurationMinutes,
  calendarSchedulingEvaluationIsUsable,
  calendarSchedulingFingerprint,
  calendarSchedulingParticipants,
  rankCalendarRooms,
} from './calendar-scheduling-assistant-model';

import type {
  CalendarAvailabilitySlot,
  CalendarResource,
  CalendarSchedulingEvaluation,
} from '@dwp-frontend/shared-utils';

type CalendarSchedulingAssistantProps = {
  open: boolean;
  startsAt: string;
  endsAt: string;
  attendees: readonly Readonly<{ personId: string }>[];
  resources: readonly CalendarResource[];
  resourcesLoading: boolean;
  resourcesError: boolean;
  selectedResourceId: string;
  language: string;
  timeZone: string;
  onApplyTime: (startsAt: string, endsAt: string) => void;
  onApplyRoom: (resource: CalendarResource) => void;
};

type AvailabilityRequest = Readonly<{
  personIds: readonly string[];
  from: string;
  to: string;
  roomStartsAt: string;
  roomEndsAt: string;
  durationMinutes: number;
  timeZone: string;
  fingerprint: string;
}>;

function requestError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function CalendarSchedulingAssistant({
  open,
  startsAt,
  endsAt,
  attendees,
  resources,
  resourcesLoading,
  resourcesError,
  selectedResourceId,
  language,
  timeZone,
  onApplyTime,
  onApplyRoom,
}: CalendarSchedulingAssistantProps) {
  const { t } = useTranslation('calendar');
  const titleId = useId();
  const [lastFingerprint, setLastFingerprint] = useState<string | null>(null);
  const [appliedFingerprint, setAppliedFingerprint] = useState<string | null>(null);
  const [, setFreshnessTick] = useState(0);
  const durationMinutes = calendarMeetingDurationMinutes(startsAt, endsAt);
  const availabilityWindow = calendarAvailabilityWindow(startsAt, timeZone);
  const participants = useMemo(() => calendarSchedulingParticipants(attendees), [attendees]);
  const fingerprint = calendarSchedulingFingerprint({
    personIds: participants.personIds,
    startsAt,
    endsAt,
    timeZone,
  });
  const availabilityMutation = useMutation<
    CalendarSchedulingEvaluation,
    Error,
    AvailabilityRequest
  >({
    mutationFn: (request) =>
      evaluateCalendarScheduling({
        personIds: [...request.personIds],
        from: request.from,
        to: request.to,
        roomStartsAt: request.roomStartsAt,
        roomEndsAt: request.roomEndsAt,
        durationMinutes: request.durationMinutes,
        timeZone: request.timeZone,
      }),
    onSuccess: (_data, request) => {
      setLastFingerprint(request.fingerprint);
      setAppliedFingerprint((current) => (current === request.fingerprint ? current : null));
    },
  });
  const resetAvailability = availabilityMutation.reset;
  const evaluationFresh = Boolean(
    availabilityMutation.data &&
    Number.isFinite(Date.parse(availabilityMutation.data.validUntil)) &&
    Date.parse(availabilityMutation.data.validUntil) > Date.now()
  );
  const evaluationUsable =
    calendarSchedulingEvaluationIsUsable(availabilityMutation.data) &&
    lastFingerprint === fingerprint;
  const rooms = useMemo(
    () =>
      rankCalendarRooms(
        availabilityMutation.data
          ? evaluationUsable
            ? availabilityMutation.data.rooms
            : []
          : resources,
        attendees.length
      ),
    [attendees.length, availabilityMutation.data, evaluationUsable, resources]
  );

  useEffect(() => {
    if (open) return;
    resetAvailability();
    setLastFingerprint(null);
    setAppliedFingerprint(null);
  }, [open, resetAvailability]);

  useEffect(() => {
    const validUntil = availabilityMutation.data?.validUntil;
    if (!validUntil) return;
    const delay = Date.parse(validUntil) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(() => setFreshnessTick((current) => current + 1), delay + 25);
    return () => window.clearTimeout(timer);
  }, [availabilityMutation.data?.validUntil]);

  const resultsStale = Boolean(
    availabilityMutation.data && (!evaluationFresh || lastFingerprint !== fingerprint)
  );
  const canSearch = Boolean(durationMinutes && availabilityWindow);
  const search = () => {
    if (!durationMinutes || !availabilityWindow) return;
    availabilityMutation.mutate({
      personIds: participants.personIds,
      from: availabilityWindow.from,
      to: availabilityWindow.to,
      roomStartsAt: startsAt,
      roomEndsAt: endsAt,
      durationMinutes,
      timeZone,
      fingerprint,
    });
  };
  const applySlot = (slot: CalendarAvailabilitySlot) => {
    const next = applyCalendarAvailabilitySlot(slot);
    const nextWindow = calendarAvailabilityWindow(next.startsAt, timeZone);
    const nextFingerprint = calendarSchedulingFingerprint({
      personIds: participants.personIds,
      startsAt: next.startsAt,
      endsAt: next.endsAt,
      timeZone,
    });
    onApplyTime(next.startsAt, next.endsAt);
    setLastFingerprint(null);
    setAppliedFingerprint(nextFingerprint);
    if (!nextWindow || !durationMinutes) {
      resetAvailability();
      return;
    }
    availabilityMutation.mutate({
      personIds: participants.personIds,
      from: nextWindow.from,
      to: nextWindow.to,
      roomStartsAt: next.startsAt,
      roomEndsAt: next.endsAt,
      durationMinutes,
      timeZone,
      fingerprint: nextFingerprint,
    });
  };

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="calendar-scheduling-assistant"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box
              sx={{
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                flex: '0 0 auto',
              }}
            >
              <Sparkles size={18} aria-hidden="true" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography id={titleId} variant="subtitle1" fontWeight={800}>
                {t('schedulingAssistant.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('schedulingAssistant.description')}
              </Typography>
            </Box>
          </Stack>
          <ActionButton
            intent="primary"
            size="small"
            startIcon={<CalendarSearch size={17} />}
            loading={availabilityMutation.isPending}
            loadingLabel={t('schedulingAssistant.checking')}
            disabled={!canSearch}
            onClick={search}
          >
            {t('schedulingAssistant.check')}
          </ActionButton>
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            icon={<UsersRound size={14} />}
            label={t('schedulingAssistant.participantSummary', {
              count: participants.personIds.length + 1,
            })}
          />
          <Chip
            size="small"
            label={t('schedulingAssistant.durationSummary', { count: durationMinutes ?? 0 })}
          />
          <Chip size="small" label={timeZone} />
        </Stack>

        {(participants.uncheckedCount > 0 || participants.overflowCount > 0) && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {participants.uncheckedCount > 0 &&
              t('schedulingAssistant.uncheckedParticipants', {
                count: participants.uncheckedCount,
              })}
            {participants.uncheckedCount > 0 && participants.overflowCount > 0 ? ' ' : ''}
            {participants.overflowCount > 0 &&
              t('schedulingAssistant.participantOverflow', {
                count: participants.overflowCount,
              })}
          </Alert>
        )}
        {!canSearch && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t('schedulingAssistant.invalidRange')}
          </Alert>
        )}
        {availabilityMutation.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {requestError(availabilityMutation.error, t('schedulingAssistant.loadError'))}
          </Alert>
        )}
        {resultsStale && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {t('schedulingAssistant.staleResults')}
          </Alert>
        )}
        {appliedFingerprint === fingerprint && (
          <Alert severity="success" icon={<Check size={18} />} sx={{ mt: 1.5 }}>
            {t('schedulingAssistant.timeApplied')}
          </Alert>
        )}

        {availabilityMutation.isPending && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <CircularProgress size={18} aria-hidden="true" />
            <Typography variant="body2" color="text.secondary" role="status">
              {t('schedulingAssistant.checkingDescription')}
            </Typography>
          </Stack>
        )}

        {availabilityMutation.data && !evaluationUsable && !resultsStale && (
          <Alert severity="warning" sx={{ mt: 1.5 }} role="status">
            {t('schedulingAssistant.incompleteResults')}
          </Alert>
        )}

        {availabilityMutation.data && evaluationUsable && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="overline" color="text.secondary">
                {t('schedulingAssistant.suggestedTimes')}
              </Typography>
              <Typography variant="caption" color="text.secondary" role="status">
                {t('schedulingAssistant.freshness', {
                  time: calendarTime(availabilityMutation.data.generatedAt, language),
                })}
              </Typography>
            </Stack>
            {availabilityMutation.data.availability.suggestions.length ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
                  gap: 1,
                  mt: 0.75,
                }}
              >
                {availabilityMutation.data.availability.suggestions.slice(0, 4).map((slot) => {
                  const label = `${calendarDate(slot.startsAt, language)} · ${calendarTime(
                    slot.startsAt,
                    language
                  )}–${calendarTime(slot.endsAt, language)}`;
                  return (
                    <ActionButton
                      key={`${slot.startsAt}:${slot.endsAt}`}
                      intent="secondary"
                      aria-label={t('schedulingAssistant.applyTimeLabel', { label })}
                      onClick={() => applySlot(slot)}
                      sx={{
                        minHeight: 58,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        px: 1.25,
                      }}
                    >
                      <Box component="span" sx={{ display: 'block', minWidth: 0 }}>
                        <Typography
                          component="span"
                          variant="body2"
                          fontWeight={800}
                          display="block"
                        >
                          {label}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          noWrap
                        >
                          {slot.reasonCode === 'ALL_REQUIRED_AVAILABLE_WITHIN_WORKING_HOURS'
                            ? t('schedulingAssistant.reasons.allRequiredAvailable')
                            : slot.reason}
                        </Typography>
                      </Box>
                    </ActionButton>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {t('schedulingAssistant.noTimes')}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      <Divider />
      <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Building2 size={16} aria-hidden="true" />
            <Typography variant="overline" color="text.secondary">
              {t('schedulingAssistant.recommendedRooms')}
            </Typography>
          </Stack>
          {resourcesLoading && (
            <CircularProgress size={16} aria-label={t('schedulingAssistant.roomsLoading')} />
          )}
        </Stack>
        {resourcesError ? (
          <Typography variant="body2" color="error" sx={{ mt: 0.75 }}>
            {t('schedulingAssistant.roomsError')}
          </Typography>
        ) : rooms.length ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
            {rooms.slice(0, 3).map((room) => (
              <ActionButton
                key={room.resourceId}
                intent={room.resourceId === selectedResourceId ? 'primary' : 'secondary'}
                size="small"
                aria-pressed={room.resourceId === selectedResourceId}
                onClick={() => onApplyRoom(room)}
              >
                {room.name} · {t('resources.capacity', { count: room.capacity })}
                {room.approvalRequired ? ` · ${t('resources.approvalRequired')}` : ''}
              </ActionButton>
            ))}
          </Stack>
        ) : (
          !resourcesLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t('schedulingAssistant.noRooms')}
            </Typography>
          )
        )}
        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1.5 }}>
          <LockKeyhole size={14} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('schedulingAssistant.privacy')}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
