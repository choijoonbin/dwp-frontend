import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Clock3,
  ListChecks,
  MessageCircleQuestion,
  Plus,
  RefreshCw,
  Send,
  ThumbsUp,
  Vote,
  X,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormField,
  InlineFeedback,
  LoadingState,
  ProgressMeter,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  answerVideoMeetingQuestion,
  askVideoMeetingQuestion,
  createVideoMeetingPoll,
  dismissVideoMeetingQuestion,
  getVideoMeetingFacilitation,
  startVideoMeetingAgendaTimer,
  transitionVideoMeetingAgendaTimer,
  transitionVideoMeetingPoll,
  upvoteVideoMeetingQuestion,
  voteVideoMeetingPoll,
  type VideoMeetingFacilitationPoll,
  type VideoMeetingFacilitationQuestion,
  type VideoMeetingFacilitationSnapshot,
} from '@dwp-frontend/shared-utils/api/video-meeting-facilitation-api';
import { getVideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  countdownParts,
  facilitationPollingInterval,
  facilitationTimerProgress,
  validPollDraft,
} from './meeting-live-facilitation-model';
import { formatMeetingTime } from './meeting-components';
import { meetingInsetSurface, meetingSurface } from './meeting-visual-system';

type FacilitationAction =
  | { kind: 'ASK'; text: string }
  | { kind: 'UPVOTE'; question: VideoMeetingFacilitationQuestion }
  | { kind: 'ANSWER'; question: VideoMeetingFacilitationQuestion; answer: string }
  | { kind: 'DISMISS'; question: VideoMeetingFacilitationQuestion }
  | { kind: 'CREATE_POLL'; question: string; options: string[] }
  | { kind: 'POLL_STATE'; poll: VideoMeetingFacilitationPoll; action: 'open' | 'close' }
  | { kind: 'VOTE'; poll: VideoMeetingFacilitationPoll; optionId: string }
  | { kind: 'START_TIMER'; agendaItemId: string; expectedVersion: number }
  | { kind: 'TIMER'; action: 'pause' | 'resume' | 'advance'; expectedVersion: number };

export function MeetingLiveFacilitationLauncher({
  meetingId,
  label,
}: {
  meetingId: string;
  label?: string;
}) {
  const { t } = useTranslation('meetings');
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<ListChecks size={16} aria-hidden="true" />}
        sx={{ color: 'common.white' }}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label ?? t('liveFacilitation.launch')}
      </ActionButton>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        sx={{ zIndex: 1450 }}
        slotProps={{
          paper: {
            'aria-labelledby': 'meeting-live-facilitation-title',
            sx: {
              width: { xs: '100%', sm: 480 },
              maxWidth: '100%',
              bgcolor: 'background.default',
            },
          },
        }}
      >
        <MeetingLiveFacilitation meetingId={meetingId} onClose={() => setOpen(false)} />
      </Drawer>
    </>
  );
}

export function MeetingLiveFacilitation({
  meetingId,
  onClose,
}: {
  meetingId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const client = useQueryClient();
  const [questionText, setQuestionText] = useState('');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [agendaItemId, setAgendaItemId] = useState('');
  const queryKey = ['meetings', meetingId, 'live-facilitation'] as const;
  const snapshot = useQuery({
    queryKey,
    queryFn: () => getVideoMeetingFacilitation(meetingId),
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : facilitationPollingInterval(query.state.data),
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const preparation = useQuery({
    queryKey: ['meetings', meetingId, 'preparation', 'facilitation'],
    queryFn: ({ signal }) => getVideoMeetingPreparation(meetingId, signal),
    enabled: Boolean(snapshot.data?.capabilities.canModerate),
    retry: false,
    staleTime: 15_000,
    meta: { accessSensitive: true },
  });
  const mutation = useMutation({
    mutationFn: (action: FacilitationAction) => executeAction(meetingId, action),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
    },
  });
  const data = snapshot.data;
  const busy = mutation.isPending;

  useEffect(() => {
    if (agendaItemId || !preparation.data?.agendaItems[0]) return;
    setAgendaItemId(preparation.data.agendaItems[0].itemId);
  }, [agendaItemId, preparation.data]);

  const openPoll = useMemo(
    () => data?.polls.find((poll) => poll.state === 'OPEN') ?? data?.polls[0] ?? null,
    [data?.polls]
  );

  return (
    <Stack sx={{ minHeight: '100%', maxHeight: '100dvh' }}>
      <Stack
        component="header"
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={2}
        sx={{ px: { xs: 2, sm: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <ListChecks size={20} aria-hidden="true" />
            <Typography
              id="meeting-live-facilitation-title"
              component="h2"
              variant="h5"
              fontWeight="fontWeightBold"
            >
              {t('liveFacilitation.title')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('liveFacilitation.description')}
          </Typography>
        </Box>
        <ActionIconButton label={t('actions.close')} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </ActionIconButton>
      </Stack>

      <Box sx={{ minHeight: 0, flex: 1, overflowY: 'auto', px: { xs: 2, sm: 2.5 }, py: 2 }}>
        {snapshot.isLoading ? (
          <LoadingState label={t('liveFacilitation.loading')} variant="skeleton" skeletonRows={6} />
        ) : snapshot.isError || !data ? (
          <ErrorState
            title={t('liveFacilitation.unavailableTitle')}
            description={t('liveFacilitation.unavailableDescription')}
            retryLabel={t('actions.retry')}
            onRetry={() => snapshot.refetch()}
          />
        ) : (
          <Stack gap={2.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Chip
                size="small"
                color={data.capabilities.meetingLive ? 'success' : 'default'}
                label={t(
                  data.capabilities.meetingLive
                    ? 'liveFacilitation.live'
                    : 'liveFacilitation.readOnly'
                )}
              />
              <Stack direction="row" alignItems="center" gap={0.5} color="text.secondary">
                <RefreshCw size={13} aria-hidden="true" />
                <Typography variant="caption">
                  {t('liveFacilitation.polling', {
                    seconds: Math.round(data.pollingIntervalMillis / 1000),
                    time: formatMeetingTime(data.serverTime, i18n.language),
                  })}
                </Typography>
              </Stack>
            </Stack>

            <TimerSection
              data={data}
              agendaItemId={agendaItemId}
              agendaOptions={(preparation.data?.agendaItems ?? []).map((item) => ({
                value: item.itemId,
                label: item.title,
              }))}
              preparationFailed={preparation.isError}
              busy={busy}
              onAgendaItem={setAgendaItemId}
              onAction={(action) => mutation.mutate(action)}
            />

            <PollSection
              data={data}
              poll={openPoll}
              question={pollQuestion}
              options={pollOptions}
              busy={busy}
              onQuestion={setPollQuestion}
              onOption={(index, value) =>
                setPollOptions((current) =>
                  current.map((option, optionIndex) => (optionIndex === index ? value : option))
                )
              }
              onAddOption={() => setPollOptions((current) => [...current, ''])}
              onAction={(action) => {
                mutation.mutate(action, {
                  onSuccess: () => {
                    if (action.kind === 'CREATE_POLL') {
                      setPollQuestion('');
                      setPollOptions(['', '']);
                    }
                  },
                });
              }}
            />

            <QuestionsSection
              data={data}
              questionText={questionText}
              answerText={answerText}
              answeringId={answeringId}
              busy={busy}
              onQuestionText={setQuestionText}
              onAnswerText={setAnswerText}
              onAnswering={setAnsweringId}
              onAction={(action) => {
                mutation.mutate(action, {
                  onSuccess: () => {
                    if (action.kind === 'ASK') setQuestionText('');
                    if (action.kind === 'ANSWER') {
                      setAnswerText('');
                      setAnsweringId(null);
                    }
                  },
                });
              }}
            />

            {mutation.isError && (
              <InlineFeedback severity="warning" title={t('liveFacilitation.commandFailed')}>
                {t('liveFacilitation.commandFailedHint')}
              </InlineFeedback>
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function TimerSection({
  data,
  agendaItemId,
  agendaOptions,
  preparationFailed,
  busy,
  onAgendaItem,
  onAction,
}: {
  data: VideoMeetingFacilitationSnapshot;
  agendaItemId: string;
  agendaOptions: Array<{ value: string; label: string }>;
  preparationFailed: boolean;
  busy: boolean;
  onAgendaItem: (value: string) => void;
  onAction: (action: FacilitationAction) => void;
}) {
  const { t } = useTranslation('meetings');
  const timer = data.timer;
  const countdown = countdownParts(timer.remainingSeconds);
  const idle = timer.state === 'IDLE' || timer.state === 'COMPLETED';
  return (
    <Box
      component="section"
      aria-labelledby="meeting-facilitation-timer-title"
      sx={(theme) => ({ ...meetingSurface(theme, { tone: 'primary' }), p: 2 })}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Clock3 size={17} aria-hidden="true" />
            <Typography
              id="meeting-facilitation-timer-title"
              component="h3"
              variant="subtitle1"
              fontWeight="fontWeightBold"
            >
              {t('liveFacilitation.timer.title')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {timer.agendaItemTitle ?? t('liveFacilitation.timer.noAgenda')}
          </Typography>
        </Box>
        <Chip size="small" label={t(`liveFacilitation.timer.states.${timer.state}`)} />
      </Stack>
      <Typography
        variant="h3"
        aria-label={t('liveFacilitation.timer.remainingAccessible', countdown)}
        sx={{ mt: 1.5, fontVariantNumeric: 'tabular-nums' }}
      >
        {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
      </Typography>
      <ProgressMeter
        label={t('liveFacilitation.timer.progress')}
        value={facilitationTimerProgress(timer)}
        valueLabel={t('liveFacilitation.timer.elapsed', { seconds: timer.elapsedSeconds })}
        sx={{ mt: 1 }}
      />
      {data.capabilities.canModerate && (
        <Stack gap={1.25} sx={{ mt: 2 }}>
          {idle && (
            <SelectField
              label={t('liveFacilitation.timer.agenda')}
              value={agendaItemId}
              options={agendaOptions}
              disabled={busy || agendaOptions.length === 0}
              onValueChange={onAgendaItem}
            />
          )}
          {preparationFailed && (
            <InlineFeedback severity="warning">
              {t('liveFacilitation.timer.agendaUnavailable')}
            </InlineFeedback>
          )}
          <Stack direction="row" gap={1} flexWrap="wrap">
            {idle ? (
              <ActionButton
                intent="primary"
                size="small"
                startIcon={<CirclePlay size={16} aria-hidden="true" />}
                disabled={busy || !agendaItemId}
                onClick={() =>
                  onAction({
                    kind: 'START_TIMER',
                    agendaItemId,
                    expectedVersion: timer.version,
                  })
                }
              >
                {t('liveFacilitation.timer.start')}
              </ActionButton>
            ) : (
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={
                  timer.state === 'RUNNING' ? (
                    <CirclePause size={16} aria-hidden="true" />
                  ) : (
                    <CirclePlay size={16} aria-hidden="true" />
                  )
                }
                disabled={busy}
                onClick={() =>
                  onAction({
                    kind: 'TIMER',
                    action: timer.state === 'RUNNING' ? 'pause' : 'resume',
                    expectedVersion: timer.version,
                  })
                }
              >
                {t(
                  timer.state === 'RUNNING'
                    ? 'liveFacilitation.timer.pause'
                    : 'liveFacilitation.timer.resume'
                )}
              </ActionButton>
            )}
            {!idle && (
              <ActionButton
                intent="quiet"
                size="small"
                endIcon={<ChevronRight size={16} aria-hidden="true" />}
                disabled={busy}
                onClick={() =>
                  onAction({ kind: 'TIMER', action: 'advance', expectedVersion: timer.version })
                }
              >
                {t('liveFacilitation.timer.next')}
              </ActionButton>
            )}
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

function PollSection({
  data,
  poll,
  question,
  options,
  busy,
  onQuestion,
  onOption,
  onAddOption,
  onAction,
}: {
  data: VideoMeetingFacilitationSnapshot;
  poll: VideoMeetingFacilitationPoll | null;
  question: string;
  options: string[];
  busy: boolean;
  onQuestion: (value: string) => void;
  onOption: (index: number, value: string) => void;
  onAddOption: () => void;
  onAction: (action: FacilitationAction) => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box component="section" aria-labelledby="meeting-facilitation-poll-title">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Vote size={17} aria-hidden="true" />
          <Typography
            id="meeting-facilitation-poll-title"
            component="h3"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('liveFacilitation.poll.title')}
          </Typography>
        </Stack>
        {poll && <Chip size="small" label={t(`liveFacilitation.poll.states.${poll.state}`)} />}
      </Stack>
      {poll ? (
        <Box sx={(theme) => ({ ...meetingSurface(theme), p: 2 })}>
          <Typography variant="body1" fontWeight="fontWeightBold">
            {poll.question}
          </Typography>
          <Stack gap={1.25} sx={{ mt: 1.5 }}>
            {poll.options.map((option) => {
              const selected = poll.myOptionId === option.optionId;
              const percent = poll.totalVotes ? (option.voteCount / poll.totalVotes) * 100 : 0;
              return (
                <Box key={option.optionId}>
                  <ActionButton
                    intent={selected ? 'primary' : 'secondary'}
                    size="small"
                    disabled={busy || !poll.canVote}
                    aria-pressed={selected}
                    onClick={() => onAction({ kind: 'VOTE', poll, optionId: option.optionId })}
                    sx={{ width: '100%', justifyContent: 'space-between', minHeight: 44 }}
                  >
                    {option.label}
                  </ActionButton>
                  <ProgressMeter
                    label={t('liveFacilitation.poll.optionResult', {
                      label: option.label,
                      count: option.voteCount,
                    })}
                    value={percent}
                    valueLabel={`${Math.round(percent)}%`}
                    size="compact"
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              );
            })}
          </Stack>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={1}
            sx={{ mt: 1.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('liveFacilitation.poll.totalVotes', { count: poll.totalVotes })}
            </Typography>
            {data.capabilities.canModerate && (
              <ActionButton
                intent={poll.state === 'OPEN' ? 'danger' : 'primary'}
                size="small"
                disabled={busy || poll.state === 'CLOSED'}
                onClick={() =>
                  onAction({
                    kind: 'POLL_STATE',
                    poll,
                    action: poll.state === 'DRAFT' ? 'open' : 'close',
                  })
                }
              >
                {t(
                  poll.state === 'DRAFT'
                    ? 'liveFacilitation.poll.open'
                    : 'liveFacilitation.poll.close'
                )}
              </ActionButton>
            )}
          </Stack>
        </Box>
      ) : (
        <InlineFeedback severity="info">{t('liveFacilitation.poll.empty')}</InlineFeedback>
      )}
      {data.capabilities.canModerate && (
        <Box
          component="details"
          sx={(theme) => ({ ...meetingInsetSurface(theme), mt: 1.25, p: 1.5 })}
        >
          <Typography
            component="summary"
            variant="body2"
            fontWeight="fontWeightBold"
            sx={{ cursor: 'pointer' }}
          >
            {t('liveFacilitation.poll.create')}
          </Typography>
          <Stack gap={1.25} sx={{ mt: 1.5 }}>
            <FormField
              label={t('liveFacilitation.poll.question')}
              value={question}
              inputProps={{ maxLength: 1000 }}
              onChange={(event) => onQuestion(event.target.value)}
            />
            {options.map((option, index) => (
              <FormField
                key={index}
                label={t('liveFacilitation.poll.option', { count: index + 1 })}
                value={option}
                inputProps={{ maxLength: 500 }}
                onChange={(event) => onOption(index, event.target.value)}
              />
            ))}
            {options.length < 6 && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<Plus size={15} />}
                onClick={onAddOption}
              >
                {t('liveFacilitation.poll.addOption')}
              </ActionButton>
            )}
            <ActionButton
              intent="primary"
              disabled={busy || !validPollDraft(question, options)}
              onClick={() => onAction({ kind: 'CREATE_POLL', question, options })}
            >
              {t('liveFacilitation.poll.saveDraft')}
            </ActionButton>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function QuestionsSection({
  data,
  questionText,
  answerText,
  answeringId,
  busy,
  onQuestionText,
  onAnswerText,
  onAnswering,
  onAction,
}: {
  data: VideoMeetingFacilitationSnapshot;
  questionText: string;
  answerText: string;
  answeringId: string | null;
  busy: boolean;
  onQuestionText: (value: string) => void;
  onAnswerText: (value: string) => void;
  onAnswering: (value: string | null) => void;
  onAction: (action: FacilitationAction) => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box component="section" aria-labelledby="meeting-facilitation-question-title">
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
        <MessageCircleQuestion size={17} aria-hidden="true" />
        <Typography
          id="meeting-facilitation-question-title"
          component="h3"
          variant="subtitle1"
          fontWeight="fontWeightBold"
        >
          {t('liveFacilitation.questions.title')}
        </Typography>
        <Chip size="small" label={data.questions.length} />
      </Stack>
      {data.capabilities.canAskQuestion && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mb: 1.5 }}>
          <FormField
            label={t('liveFacilitation.questions.askLabel')}
            value={questionText}
            inputProps={{ maxLength: 2000 }}
            onChange={(event) => onQuestionText(event.target.value)}
            sx={{ flex: 1 }}
          />
          <ActionButton
            intent="primary"
            startIcon={<Send size={15} aria-hidden="true" />}
            disabled={busy || questionText.trim().length === 0}
            onClick={() => onAction({ kind: 'ASK', text: questionText })}
            sx={{ minHeight: 44, alignSelf: { sm: 'flex-end' } }}
          >
            {t('liveFacilitation.questions.ask')}
          </ActionButton>
        </Stack>
      )}
      <Stack gap={1}>
        {data.questions.length === 0 ? (
          <InlineFeedback severity="info">{t('liveFacilitation.questions.empty')}</InlineFeedback>
        ) : (
          data.questions.map((question) => (
            <Box key={question.questionId} sx={(theme) => ({ ...meetingSurface(theme), p: 1.75 })}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {question.text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('liveFacilitation.questions.by', { name: question.authorDisplayName })}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={t(`liveFacilitation.questions.states.${question.state}`)}
                />
              </Stack>
              {question.answer && (
                <Box
                  sx={(theme) => ({ ...meetingInsetSurface(theme, 'success'), mt: 1.25, p: 1.25 })}
                >
                  <Stack direction="row" gap={0.75} alignItems="flex-start">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <Typography variant="body2">{question.answer}</Typography>
                  </Stack>
                </Box>
              )}
              <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
                <ActionButton
                  intent={question.upvotedByMe ? 'primary' : 'quiet'}
                  size="small"
                  startIcon={<ThumbsUp size={14} aria-hidden="true" />}
                  disabled={busy || question.upvotedByMe || question.state !== 'OPEN'}
                  onClick={() => onAction({ kind: 'UPVOTE', question })}
                >
                  {question.upvoteCount}
                </ActionButton>
                {data.capabilities.canModerate && question.state === 'OPEN' && (
                  <>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      onClick={() => {
                        onAnswering(question.questionId);
                        onAnswerText('');
                      }}
                    >
                      {t('liveFacilitation.questions.answer')}
                    </ActionButton>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      disabled={busy}
                      onClick={() => onAction({ kind: 'DISMISS', question })}
                    >
                      {t('liveFacilitation.questions.dismiss')}
                    </ActionButton>
                  </>
                )}
              </Stack>
              {answeringId === question.questionId && (
                <Stack gap={1} sx={{ mt: 1.25 }}>
                  <Divider />
                  <FormField
                    multiline
                    minRows={2}
                    label={t('liveFacilitation.questions.answerLabel')}
                    value={answerText}
                    inputProps={{ maxLength: 4000 }}
                    onChange={(event) => onAnswerText(event.target.value)}
                  />
                  <Stack direction="row" gap={1} justifyContent="flex-end">
                    <ActionButton intent="quiet" size="small" onClick={() => onAnswering(null)}>
                      {t('actions.cancel')}
                    </ActionButton>
                    <ActionButton
                      intent="primary"
                      size="small"
                      disabled={busy || answerText.trim().length === 0}
                      onClick={() => onAction({ kind: 'ANSWER', question, answer: answerText })}
                    >
                      {t('liveFacilitation.questions.publishAnswer')}
                    </ActionButton>
                  </Stack>
                </Stack>
              )}
            </Box>
          ))
        )}
      </Stack>
    </Box>
  );
}

async function executeAction(meetingId: string, action: FacilitationAction) {
  const key = crypto.randomUUID();
  switch (action.kind) {
    case 'ASK':
      return askVideoMeetingQuestion(meetingId, action.text, key);
    case 'UPVOTE':
      return upvoteVideoMeetingQuestion(meetingId, action.question.questionId, key);
    case 'ANSWER':
      return answerVideoMeetingQuestion(
        meetingId,
        action.question.questionId,
        action.answer,
        action.question.version,
        key
      );
    case 'DISMISS':
      return dismissVideoMeetingQuestion(
        meetingId,
        action.question.questionId,
        action.question.version,
        key
      );
    case 'CREATE_POLL':
      return createVideoMeetingPoll(
        meetingId,
        {
          question: action.question.trim(),
          options: action.options.map((value) => value.trim()),
          anonymous: true,
        },
        key
      );
    case 'POLL_STATE':
      return transitionVideoMeetingPoll(
        meetingId,
        action.poll.pollId,
        action.action,
        action.poll.version,
        key
      );
    case 'VOTE':
      return voteVideoMeetingPoll(
        meetingId,
        action.poll.pollId,
        action.optionId,
        action.poll.myBallotVersion,
        key
      );
    case 'START_TIMER':
      return startVideoMeetingAgendaTimer(
        meetingId,
        action.agendaItemId,
        action.expectedVersion,
        key
      );
    case 'TIMER':
      return transitionVideoMeetingAgendaTimer(
        meetingId,
        action.action,
        action.expectedVersion,
        key
      );
  }
}
