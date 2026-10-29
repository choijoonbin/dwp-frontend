import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarSearch, Check, LockKeyhole, UsersRound } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system';
import {
  evaluateCalendarSchedulingV2,
  hardRecheckCalendarSchedulingV2,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { calendarDate, calendarTime } from './calendar-components';
import { CalendarSchedulingEvidence } from './calendar-scheduling-evidence';
import {
  calendarSchedulingAssistedDraftFingerprintV2,
  calendarSchedulingVerificationReceiptV2,
  type CalendarSchedulingVerificationReceiptV2,
} from './calendar-scheduling-final-check';
import { CalendarSchedulingMatrix } from './calendar-scheduling-matrix';
import {
  calendarAvailabilityWindow,
  calendarMeetingDurationMinutes,
} from './calendar-scheduling-assistant-model';
import {
  calendarSchedulingCandidateDecisionV2,
  calendarSchedulingCurrentCandidateV2,
  calendarSchedulingEvaluationStateV2,
  calendarSchedulingFingerprintV2,
  calendarSchedulingParticipantsV2,
} from './calendar-scheduling-v2-model';

import type {
  CalendarResource,
  CalendarSchedulingCandidateV2,
  CalendarSchedulingEvaluationInputV2,
  CalendarSchedulingEvaluationV2,
  CalendarSchedulingRoomRecommendationV2,
} from '@dwp-frontend/shared-utils';

type CalendarSchedulingAssistantProps = {
  open: boolean;
  startsAt: string;
  endsAt: string;
  attendees: readonly Readonly<{
    personId: string;
    displayName?: string | null;
    type?: string;
  }>[];
  selectedResourceId: string;
  language: string;
  timeZone: string;
  onApplyTime: (
    startsAt: string,
    endsAt: string,
    receipt: CalendarSchedulingVerificationReceiptV2
  ) => void;
  onApplyRoom: (
    resource: CalendarResource,
    receipt: CalendarSchedulingVerificationReceiptV2
  ) => void;
};

type EvaluationRequest = Readonly<{
  input: CalendarSchedulingEvaluationInputV2;
  fingerprint: string;
}>;

type ApplyRequest = Readonly<{
  evaluation: CalendarSchedulingEvaluationV2;
  candidate: CalendarSchedulingCandidateV2;
  room: CalendarSchedulingRoomRecommendationV2 | null;
  action: 'TIME' | 'ROOM';
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
  selectedResourceId,
  language,
  timeZone,
  onApplyTime,
  onApplyRoom,
}: CalendarSchedulingAssistantProps) {
  const { t, i18n } = useTranslation('calendar');
  const titleId = useId();
  const [lastFingerprint, setLastFingerprint] = useState<string | null>(null);
  const [recheckFailure, setRecheckFailure] = useState<'BLOCKED' | 'ERROR' | null>(null);
  const [appliedSelection, setAppliedSelection] = useState<string | null>(null);
  const [appliedRoomId, setAppliedRoomId] = useState<string | null>(null);
  const [, setFreshnessTick] = useState(0);
  const durationMinutes = calendarMeetingDurationMinutes(startsAt, endsAt);
  const availabilityWindow = calendarAvailabilityWindow(startsAt, timeZone);
  const participants = useMemo(() => calendarSchedulingParticipantsV2(attendees), [attendees]);
  const input = useMemo<CalendarSchedulingEvaluationInputV2 | null>(() => {
    if (!durationMinutes || !availabilityWindow) return null;
    return {
      participants: [...participants.participants],
      searchWindow: availabilityWindow,
      candidateSlot: { startsAt, endsAt },
      durationMinutes,
      searchTimeZone: timeZone,
      roomCriteria: {
        minimumCapacity: attendees.length + 1,
        requiredFeatures: [],
        preferredFeatures: ['VIDEO'],
        approvalPreference: 'PREFER_NO_APPROVAL',
      },
    };
  }, [
    attendees.length,
    availabilityWindow,
    durationMinutes,
    endsAt,
    participants,
    startsAt,
    timeZone,
  ]);
  const fingerprint = input
    ? `${calendarSchedulingFingerprintV2(input)}:${selectedResourceId}`
    : 'INVALID';
  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;

  const evaluationMutation = useMutation<CalendarSchedulingEvaluationV2, Error, EvaluationRequest>({
    mutationFn: (request) => evaluateCalendarSchedulingV2(request.input),
    onSuccess: (_evaluation, request) => {
      setLastFingerprint(request.fingerprint);
      setRecheckFailure(null);
    },
  });
  const resetEvaluation = evaluationMutation.reset;
  const recheckMutation = useMutation({
    mutationFn: (request: ApplyRequest) => {
      const challengeToken = request.evaluation.challengeToken;
      if (!challengeToken) throw new Error('A fresh scheduling challenge is required.');
      return hardRecheckCalendarSchedulingV2(request.evaluation.evaluationId, {
        challengeToken,
        criteriaHash: request.evaluation.criteriaHash,
        selection: {
          startsAt: request.candidate.startsAt,
          endsAt: request.candidate.endsAt,
        },
        roomId: (request.room?.room.resourceId ?? selectedResourceId) || null,
      });
    },
    onSuccess: (recheck, request) => {
      const current = request.fingerprint === fingerprintRef.current;
      const roomId = (request.room?.room.resourceId ?? selectedResourceId) || null;
      const draftFingerprint = calendarSchedulingAssistedDraftFingerprintV2({
        startsAt: request.candidate.startsAt,
        endsAt: request.candidate.endsAt,
        timeZone,
        attendees,
        resourceId: roomId,
      });
      const receipt = calendarSchedulingVerificationReceiptV2(
        request.evaluation,
        recheck,
        { startsAt: request.candidate.startsAt, endsAt: request.candidate.endsAt },
        roomId,
        draftFingerprint
      );
      if (!current || !receipt) {
        setRecheckFailure('BLOCKED');
        return;
      }
      if (request.action === 'TIME') {
        setAppliedSelection(`${request.candidate.startsAt}:${request.candidate.endsAt}`);
        onApplyTime(request.candidate.startsAt, request.candidate.endsAt, receipt);
      } else if (request.room) {
        setAppliedRoomId(request.room.room.resourceId);
        onApplyRoom(request.room.room, receipt);
      }
    },
    onError: () => setRecheckFailure('ERROR'),
    onSettled: () => {
      setLastFingerprint(null);
      resetEvaluation();
    },
  });
  const resetRecheck = recheckMutation.reset;

  useEffect(() => {
    if (!open) {
      resetEvaluation();
      resetRecheck();
      setLastFingerprint(null);
      setRecheckFailure(null);
    }
  }, [open, resetEvaluation, resetRecheck]);

  useEffect(() => {
    if (!lastFingerprint || lastFingerprint === fingerprint) return;
    resetEvaluation();
    resetRecheck();
    setLastFingerprint(null);
    setRecheckFailure(null);
  }, [fingerprint, lastFingerprint, resetEvaluation, resetRecheck]);

  useEffect(() => {
    const validUntil = evaluationMutation.data?.validUntil;
    if (!validUntil) return;
    const delay = Date.parse(validUntil) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(() => setFreshnessTick((current) => current + 1), delay + 25);
    return () => window.clearTimeout(timer);
  }, [evaluationMutation.data?.validUntil]);

  const evaluationMatches = lastFingerprint === fingerprint;
  const evaluationState = calendarSchedulingEvaluationStateV2(
    evaluationMutation.data,
    evaluationMatches
  );
  const evaluationVisible = Boolean(evaluationMutation.data && evaluationMatches);
  const participantsVerified =
    participants.uncheckedCount === 0 && participants.overflowCount === 0;
  const search = () => {
    if (!input) return;
    resetRecheck();
    setRecheckFailure(null);
    evaluationMutation.mutate({ input, fingerprint });
  };
  const apply = (
    evaluation: CalendarSchedulingEvaluationV2,
    candidate: CalendarSchedulingCandidateV2,
    action: ApplyRequest['action'],
    room: CalendarSchedulingRoomRecommendationV2 | null = null
  ) => recheckMutation.mutate({ evaluation, candidate, room, action, fingerprint });
  const currentCandidate = evaluationMutation.data
    ? calendarSchedulingCurrentCandidateV2(evaluationMutation.data, startsAt, endsAt)
    : null;
  const currentDecision =
    evaluationMutation.data && currentCandidate
      ? calendarSchedulingCandidateDecisionV2(
          evaluationMutation.data,
          currentCandidate,
          evaluationMatches
        )
      : null;
  const applied =
    appliedSelection === `${startsAt}:${endsAt}` || appliedRoomId === selectedResourceId;

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="calendar-scheduling-assistant"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', p: 2 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography id={titleId} variant="subtitle1" fontWeight={800}>
            {t('schedulingAssistant.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('schedulingAssistant.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          size="small"
          startIcon={<CalendarSearch size={17} />}
          loading={evaluationMutation.isPending}
          loadingLabel={t('schedulingAssistant.checking')}
          disabled={!input || recheckMutation.isPending}
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
            count: participants.participants.length + 1,
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
          {t('schedulingAssistant.uncheckedOrOverflow', {
            unchecked: participants.uncheckedCount,
            overflow: participants.overflowCount,
          })}
        </Alert>
      )}
      {!input && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('schedulingAssistant.invalidRange')}
        </Alert>
      )}
      {evaluationMutation.isError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {requestError(evaluationMutation.error, t('schedulingAssistant.loadError'))}
        </Alert>
      )}
      {evaluationState === 'STALE' || evaluationState === 'MISMATCH' ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('schedulingAssistant.staleResults')}
        </Alert>
      ) : null}
      {evaluationState === 'PARTIAL' || evaluationState === 'UNKNOWN' ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t(
            evaluationState === 'PARTIAL'
              ? 'schedulingAssistant.partialBlocked'
              : 'schedulingAssistant.unknownBlocked'
          )}
        </Alert>
      ) : null}
      {recheckFailure && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {t(
            recheckFailure === 'ERROR'
              ? 'schedulingAssistant.hardRecheckFailed'
              : 'schedulingAssistant.hardRecheckBlocked'
          )}
        </Alert>
      )}
      {applied && (
        <Alert severity="success" icon={<Check size={18} />} sx={{ mt: 1.5 }}>
          {t('schedulingAssistant.timeApplied')}
        </Alert>
      )}
      {recheckMutation.isPending && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} role="status">
          <CircularProgress size={18} aria-hidden="true" />
          <Typography variant="body2">{t('schedulingAssistant.hardRechecking')}</Typography>
        </Stack>
      )}

      {evaluationVisible && evaluationMutation.data ? (
        <>
          <CalendarSchedulingMatrix
            evaluation={evaluationMutation.data}
            participantLabels={participants.labels}
            language={language}
            timeZone={timeZone}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" color="text.secondary">
              {t('schedulingAssistant.suggestedTimes')}
            </Typography>
            <Stack spacing={1} sx={{ mt: 0.75 }}>
              {evaluationMutation.data.suggestions.map((candidate) => {
                const decision = calendarSchedulingCandidateDecisionV2(
                  evaluationMutation.data!,
                  candidate,
                  evaluationMatches
                );
                const label = `${calendarDate(candidate.startsAt, language, true, timeZone)} · ${calendarTime(
                  candidate.startsAt,
                  language,
                  timeZone
                )}–${calendarTime(candidate.endsAt, language, timeZone)}`;
                const reasonCode = candidate.reasonCodes[0] ?? 'ALL_REQUIRED_AVAILABLE';
                const reasonKey = `schedulingAssistant.reasons.${reasonCode}`;
                return (
                  <ActionButton
                    key={candidate.candidateId}
                    intent="secondary"
                    disabled={
                      !participantsVerified || !decision.canApply || recheckMutation.isPending
                    }
                    aria-label={t('schedulingAssistant.applyTimeLabel', { label })}
                    onClick={() => apply(evaluationMutation.data!, candidate, 'TIME')}
                    sx={{ minHeight: 58, justifyContent: 'flex-start', textAlign: 'left' }}
                  >
                    <Box component="span" sx={{ display: 'block' }}>
                      <Typography component="span" variant="body2" fontWeight={800} display="block">
                        {label}
                      </Typography>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {i18n.exists(reasonKey, { ns: 'calendar' })
                          ? t(reasonKey)
                          : t('schedulingAssistant.reasonFallback')}
                        {decision.optionalConflictCount
                          ? ` · ${t('schedulingAssistant.optionalConflictWarning', {
                              count: decision.optionalConflictCount,
                            })}`
                          : ''}
                      </Typography>
                    </Box>
                  </ActionButton>
                );
              })}
              {!evaluationMutation.data.suggestions.length ? (
                <Typography variant="body2" color="text.secondary">
                  {t('schedulingAssistant.noTimes')}
                </Typography>
              ) : null}
            </Stack>
          </Box>
          <CalendarSchedulingEvidence
            sources={evaluationMutation.data.sources}
            rooms={evaluationMutation.data.rooms}
            selectedResourceId={selectedResourceId}
            applyingResourceId={
              recheckMutation.isPending && recheckMutation.variables?.room
                ? recheckMutation.variables.room.room.resourceId
                : null
            }
            roomActionsDisabled={
              !participantsVerified || !currentDecision?.canApply || recheckMutation.isPending
            }
            onApplyRoom={(room) =>
              currentCandidate && apply(evaluationMutation.data!, currentCandidate, 'ROOM', room)
            }
          />
        </>
      ) : null}

      <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1.5 }}>
        <LockKeyhole size={14} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          {t('schedulingAssistant.privacy')}
        </Typography>
      </Stack>
    </Box>
  );
}
