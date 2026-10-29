import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListChecks, Plus, RefreshCw } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCalendars, HttpError, useAuth } from '@dwp-frontend/shared-utils';
import { resolveIdempotentMutationIntent } from '@dwp-frontend/shared-utils/api/idempotent-mutation-intent';
import { ActionButton, InlineFeedback, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  cancelCalendarSchedulingPoll,
  castCalendarSchedulingPollVotes,
  confirmCalendarSchedulingPoll,
  createCalendarSchedulingPoll,
  getCalendarSchedulingPoll,
  listCalendarSchedulingPolls,
  openCalendarSchedulingPoll,
} from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';
import {
  calendarSchedulingPollActions,
  calendarSchedulingPollCreateInput,
  calendarSchedulingPollInitialVoteChoices,
  calendarSchedulingPollVoteInput,
  formatCalendarSchedulingPollDateTime,
  type CalendarSchedulingPollDraft,
  type CalendarSchedulingPollVoteChoices,
} from './calendar-scheduling-poll-model';
import {
  CalendarSchedulingPollOrganizer,
  type CalendarSchedulingPollOrganizerAction,
} from './calendar-scheduling-poll-organizer';
import { CalendarSchedulingPollParticipant } from './calendar-scheduling-poll-participant';
import { CalendarSchedulingPollCreator } from './calendar-scheduling-poll-creator';
import {
  calendarReadSourceState,
  retryRecoverableCalendarRead,
} from './calendar-read-source-state';

import type { IdempotentMutationIntent } from '@dwp-frontend/shared-utils/api/idempotent-mutation-intent';
import type {
  CalendarSchedulingPollDetails,
  CalendarSchedulingPollPage,
  CalendarSchedulingPollVoteChoice,
} from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';

const PAGE_SIZE = 25;

export type CalendarSchedulingPollCursor = Readonly<{
  afterUpdatedAt: string;
  afterPollId: string;
}>;

export function calendarSchedulingPollNextPageParam(
  lastPage: CalendarSchedulingPollPage,
  used: readonly (CalendarSchedulingPollCursor | null)[]
): CalendarSchedulingPollCursor | undefined {
  if (!lastPage.hasMore || !lastPage.nextUpdatedAt || !lastPage.nextPollId) return undefined;
  const next = {
    afterUpdatedAt: lastPage.nextUpdatedAt,
    afterPollId: lastPage.nextPollId,
  };
  return used.some(
    (cursor) =>
      cursor?.afterUpdatedAt === next.afterUpdatedAt && cursor.afterPollId === next.afterPollId
  )
    ? undefined
    : next;
}

export function mergeCalendarSchedulingPollPages(
  pages: readonly CalendarSchedulingPollPage[] | undefined
) {
  const items = new Map<string, CalendarSchedulingPollDetails>();
  for (const page of pages ?? []) {
    for (const item of page.items) {
      const current = items.get(item.poll.pollId);
      if (!current || item.poll.version > current.poll.version) items.set(item.poll.pollId, item);
    }
  }
  return [...items.values()];
}

export function calendarSchedulingPollQueryKeys(identity: string | null) {
  const root = ['calendar', 'scheduling-polls', identity] as const;
  return {
    root,
    list: [...root, 'list'] as const,
    detail: (pollId: string | null) => [...root, 'detail', pollId] as const,
    calendars: [...root, 'calendars'] as const,
  };
}

export function CalendarSchedulingPollWorkspace({
  creationDraft = null,
  initialPollId = null,
  now: fixedNow,
  onRequestCreate,
  onCreated,
}: Readonly<{
  creationDraft?: CalendarSchedulingPollDraft | null;
  initialPollId?: string | null;
  now?: number;
  onRequestCreate?: () => void;
  onCreated?: (details: CalendarSchedulingPollDetails) => void;
}>) {
  const { t, i18n } = useTranslation('calendar');
  const auth = useAuth();
  const queryClient = useQueryClient();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const personPublicId = auth.user?.personPublicId ?? null;
  const identity =
    auth.isAuthenticated && auth.user && personPublicId
      ? `${auth.user.tenantId}:${auth.user.userId}:${personPublicId}`
      : null;
  const keys = useMemo(() => calendarSchedulingPollQueryKeys(identity), [identity]);
  const [revoked, setRevoked] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(initialPollId);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [voteChoices, setVoteChoices] = useState<CalendarSchedulingPollVoteChoices>({});
  const [voteComment, setVoteComment] = useState('');
  const [savedVotePollId, setSavedVotePollId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => fixedNow ?? Date.now());
  const createIntent = useRef<IdempotentMutationIntent | null>(null);
  const voteIntents = useRef(new Map<string, IdempotentMutationIntent>());
  const confirmIntents = useRef(new Map<string, IdempotentMutationIntent>());
  const authenticated = Boolean(identity && !auth.isLoading && !revoked);

  const clearPrivateState = useCallback(() => {
    setSelectedPollId(initialPollId);
    setCreatorOpen(false);
    setSelectedCandidateId('');
    setSelectedCalendarId('');
    setVoteChoices({});
    setVoteComment('');
    setSavedVotePollId(null);
    createIntent.current = null;
    voteIntents.current.clear();
    confirmIntents.current.clear();
  }, [initialPollId]);

  useEffect(() => {
    setRevoked(false);
    clearPrivateState();
    return () => {
      void queryClient.cancelQueries({ queryKey: keys.root });
      queryClient.removeQueries({ queryKey: keys.root });
    };
  }, [clearPrivateState, identity, keys.root, queryClient]);

  const revoke = useCallback(() => {
    setRevoked(true);
    clearPrivateState();
    void queryClient.cancelQueries({ queryKey: keys.root });
    queryClient.removeQueries({ queryKey: keys.root });
  }, [clearPrivateState, keys.root, queryClient]);

  const pollsQuery = useInfiniteQuery({
    queryKey: keys.list,
    enabled: authenticated,
    initialPageParam: null as CalendarSchedulingPollCursor | null,
    queryFn: ({ pageParam, signal }) =>
      listCalendarSchedulingPolls(
        {
          afterUpdatedAt: pageParam?.afterUpdatedAt,
          afterPollId: pageParam?.afterPollId,
          limit: PAGE_SIZE,
        },
        signal
      ),
    getNextPageParam: (lastPage, _pages, _lastPageParam, pageParams) =>
      calendarSchedulingPollNextPageParam(lastPage, pageParams),
    staleTime: 15_000,
    gcTime: 0,
    retry: retryRecoverableCalendarRead,
    meta: { accessSensitive: true, identity },
  });
  const pollItems = useMemo(
    () => mergeCalendarSchedulingPollPages(pollsQuery.data?.pages),
    [pollsQuery.data?.pages]
  );
  const pollsState = calendarReadSourceState({
    data: pollsQuery.data,
    error: pollsQuery.error,
    failureCount: pollsQuery.failureCount,
    failureReason: pollsQuery.failureReason,
    isError: pollsQuery.isError,
    isPending: pollsQuery.isPending,
  });

  useEffect(() => {
    if (!selectedPollId && pollItems[0]) setSelectedPollId(pollItems[0].poll.pollId);
  }, [pollItems, selectedPollId]);

  const detailQuery = useQuery({
    queryKey: keys.detail(selectedPollId),
    queryFn: ({ signal }) => getCalendarSchedulingPoll(selectedPollId!, signal),
    enabled: authenticated && Boolean(selectedPollId),
    staleTime: 10_000,
    gcTime: 0,
    retry: retryRecoverableCalendarRead,
    meta: { accessSensitive: true, identity },
  });
  const detailsState = calendarReadSourceState({
    data: detailQuery.data,
    error: detailQuery.error,
    failureCount: detailQuery.failureCount,
    failureReason: detailQuery.failureReason,
    isError: detailQuery.isError,
    isPending: detailQuery.isPending,
  });
  const details =
    detailsState === 'READY' || detailsState === 'STALE' ? detailQuery.data : undefined;
  const actions = details ? calendarSchedulingPollActions(details, personPublicId, clockNow) : null;

  const calendarsQuery = useQuery({
    queryKey: keys.calendars,
    queryFn: ({ signal }) => getCalendars(signal),
    enabled: authenticated && Boolean(actions?.canConfirm),
    staleTime: 60_000,
    gcTime: 0,
    retry: retryRecoverableCalendarRead,
    meta: { accessSensitive: true, identity },
  });
  const calendars = useMemo(
    () =>
      (calendarsQuery.data ?? [])
        .filter((calendar) => calendar.capabilities?.canCreateEvents === true)
        .map((calendar) => ({ calendarId: calendar.calendarId, name: calendar.name })),
    [calendarsQuery.data]
  );

  useEffect(() => {
    if (fixedNow !== undefined) {
      setClockNow(fixedNow);
      return undefined;
    }
    const expiresAt = details ? Date.parse(details.poll.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAt)) return undefined;
    const delay = Math.max(0, expiresAt - Date.now() + 25);
    const timer = window.setTimeout(() => setClockNow(Date.now()), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [details, fixedNow]);

  const detailPollId = details?.poll.pollId ?? null;
  const serverVoteChoices = details ? calendarSchedulingPollInitialVoteChoices(details) : {};
  const serverVoteChoicesJson = JSON.stringify(serverVoteChoices);
  useEffect(() => {
    if (!detailPollId) return;
    setVoteChoices(JSON.parse(serverVoteChoicesJson) as CalendarSchedulingPollVoteChoices);
    setVoteComment('');
    setSavedVotePollId(null);
  }, [detailPollId, serverVoteChoicesJson]);

  const eligibleCandidateKey = actions?.eligibleCandidateIds.join(':') ?? '';
  useEffect(() => {
    const eligible = eligibleCandidateKey ? eligibleCandidateKey.split(':') : [];
    setSelectedCandidateId((current) =>
      eligible.includes(current) ? current : (eligible[0] ?? '')
    );
  }, [eligibleCandidateKey]);
  useEffect(() => {
    setSelectedCalendarId((current) =>
      calendars.some((calendar) => calendar.calendarId === current)
        ? current
        : (calendars[0]?.calendarId ?? '')
    );
  }, [calendars]);

  useEffect(() => {
    if (authenticated && (pollsState === 'DENIED' || detailsState === 'DENIED')) {
      revoke();
    }
  }, [authenticated, detailsState, pollsState, revoke]);

  const acceptDetails = useCallback(
    async (saved: CalendarSchedulingPollDetails, eventCreated = false) => {
      setSelectedPollId(saved.poll.pollId);
      queryClient.setQueryData(keys.detail(saved.poll.pollId), saved);
      await queryClient.invalidateQueries({ queryKey: keys.list });
      if (eventCreated) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] }),
          queryClient.invalidateQueries({ queryKey: ['calendar', 'events-v2'] }),
        ]);
      }
    },
    [keys, queryClient]
  );
  const handleCommandError = useCallback(
    (error: unknown, pollId?: string) => {
      if (error instanceof HttpError && [401, 403].includes(error.status)) {
        revoke();
        return;
      }
      if (error instanceof HttpError && [404, 409].includes(error.status)) {
        void queryClient.invalidateQueries({ queryKey: keys.list });
        if (pollId) void queryClient.invalidateQueries({ queryKey: keys.detail(pollId) });
      }
    },
    [keys, queryClient, revoke]
  );

  const createMutation = useMutation({
    mutationFn: (draft: CalendarSchedulingPollDraft) => {
      const intent = resolveIdempotentMutationIntent(createIntent.current, draft);
      createIntent.current = intent;
      return createCalendarSchedulingPoll(
        calendarSchedulingPollCreateInput(draft, intent.key, clockNow)
      );
    },
    onSuccess: async (saved) => {
      createIntent.current = null;
      setCreatorOpen(false);
      await acceptDetails(saved);
      onCreated?.(saved);
    },
    onError: (error) => handleCommandError(error),
  });
  const openMutation = useMutation({
    mutationFn: (input: { pollId: string; version: number }) =>
      openCalendarSchedulingPoll(input.pollId, input.version),
    onSuccess: (saved) => acceptDetails(saved),
    onError: (error, input) => handleCommandError(error, input.pollId),
  });
  const cancelMutation = useMutation({
    mutationFn: (input: { pollId: string; version: number }) =>
      cancelCalendarSchedulingPoll(input.pollId, input.version),
    onSuccess: (saved) => acceptDetails(saved),
    onError: (error, input) => handleCommandError(error, input.pollId),
  });
  const voteMutation = useMutation({
    mutationFn: (input: {
      details: CalendarSchedulingPollDetails;
      choices: CalendarSchedulingPollVoteChoices;
      comment: string;
    }) => {
      const pollId = input.details.poll.pollId;
      const previous = voteIntents.current.get(pollId) ?? null;
      const intent = resolveIdempotentMutationIntent(previous, {
        pollId,
        choices: input.choices,
        comment: input.comment,
      });
      voteIntents.current.set(pollId, intent);
      return castCalendarSchedulingPollVotes(
        pollId,
        calendarSchedulingPollVoteInput(
          input.details,
          personPublicId!,
          input.choices,
          input.comment,
          intent.key,
          clockNow
        )
      );
    },
    onSuccess: async (saved) => {
      voteIntents.current.delete(saved.poll.pollId);
      setSavedVotePollId(saved.poll.pollId);
      await acceptDetails(saved);
    },
    onError: (error, input) => handleCommandError(error, input.details.poll.pollId),
  });
  const confirmMutation = useMutation({
    mutationFn: (input: {
      pollId: string;
      candidateId: string;
      calendarId: string;
      version: number;
    }) => {
      const previous = confirmIntents.current.get(input.pollId) ?? null;
      const intent = resolveIdempotentMutationIntent(previous, input);
      confirmIntents.current.set(input.pollId, intent);
      return confirmCalendarSchedulingPoll(input.pollId, {
        candidateId: input.candidateId,
        calendarId: input.calendarId,
        version: input.version,
        idempotencyKey: intent.key,
      });
    },
    onSuccess: async (saved) => {
      confirmIntents.current.delete(saved.poll.pollId);
      await acceptDetails(saved, true);
    },
    onError: (error, input) => handleCommandError(error, input.pollId),
  });

  const mutationError =
    createMutation.error ??
    openMutation.error ??
    cancelMutation.error ??
    voteMutation.error ??
    confirmMutation.error;
  const commandErrorMessage = mutationError
    ? t(
        mutationError instanceof HttpError && mutationError.status === 409
          ? 'polls.workspace.versionConflict'
          : 'polls.workspace.commandError'
      )
    : null;
  const busyOrganizerAction: CalendarSchedulingPollOrganizerAction | null = openMutation.isPending
    ? 'OPEN'
    : cancelMutation.isPending
      ? 'CANCEL'
      : confirmMutation.isPending
        ? 'CONFIRM'
        : null;
  const lastPage = pollsQuery.data?.pages.at(-1);
  const invalidNextCursor = Boolean(lastPage?.hasMore && !pollsQuery.hasNextPage);

  if (auth.isLoading) {
    return <Typography role="status">{t('polls.workspace.loadingIdentity')}</Typography>;
  }
  if (!identity || !auth.isAuthenticated || revoked) {
    return <InlineFeedback severity="warning">{t('polls.workspace.denied')}</InlineFeedback>;
  }

  return (
    <Box
      component="main"
      data-testid="calendar-scheduling-poll-workspace"
      sx={{ maxWidth: 1280, mx: 'auto' }}
    >
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography
          component="h1"
          variant="h5"
          fontWeight={foundationTokens.home.typography.weightHeavy}
        >
          {t('polls.workspace.title')}
        </Typography>
        <Typography color="text.secondary">{t('polls.workspace.description')}</Typography>
      </Stack>

      <Stack
        component="section"
        aria-label={t('polls.workspace.createSection')}
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.control,
          p: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Typography fontWeight={foundationTokens.home.typography.weightBold}>
            {t('polls.workspace.createTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              creationDraft ? 'polls.workspace.createReady' : 'polls.workspace.createFromSchedule'
            )}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          startIcon={<Plus size={17} aria-hidden="true" />}
          disabled={creatorOpen}
          onClick={() => {
            onRequestCreate?.();
            setCreatorOpen(true);
          }}
        >
          {t('polls.workspace.create')}
        </ActionButton>
      </Stack>
      {creatorOpen ? (
        <CalendarSchedulingPollCreator
          organizer={{
            personPublicId: personPublicId!,
            displayName: auth.user?.displayName ?? t('polls.creator.organizerFallback'),
          }}
          initialDraft={creationDraft}
          submitting={createMutation.isPending}
          errorMessage={createMutation.error ? commandErrorMessage : null}
          now={clockNow}
          onCancel={() => {
            createMutation.reset();
            createIntent.current = null;
            setCreatorOpen(false);
          }}
          onSubmit={(draft) => createMutation.mutate(draft)}
        />
      ) : null}

      {pollsState === 'LOADING' ? (
        <Typography role="status">{t('polls.workspace.loading')}</Typography>
      ) : pollsState === 'DENIED' ? (
        <InlineFeedback severity="warning">{t('polls.workspace.denied')}</InlineFeedback>
      ) : pollsState === 'UNAVAILABLE' ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void pollsQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('polls.workspace.unavailable')}
        </InlineFeedback>
      ) : (
        <>
          {pollsState === 'STALE' ? (
            <InlineFeedback severity="warning">{t('polls.workspace.stale')}</InlineFeedback>
          ) : null}
          {commandErrorMessage ? (
            <InlineFeedback severity="error">{commandErrorMessage}</InlineFeedback>
          ) : null}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(16rem, 0.34fr) minmax(0, 1fr)' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box
              component="nav"
              aria-label={t('polls.workspace.listLabel')}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: foundationTokens.radius.control,
                overflow: 'hidden',
              }}
            >
              <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1.25 }}>
                <ListChecks size={18} aria-hidden="true" />
                <Typography fontWeight={foundationTokens.home.typography.weightEmphasis}>
                  {t('polls.workspace.listTitle')}
                </Typography>
              </Stack>
              <Divider />
              {pollItems.length ? (
                <Stack spacing={0.5} sx={{ p: 1 }}>
                  {pollItems.map((item) => (
                    <ActionButton
                      key={item.poll.pollId}
                      intent={selectedPollId === item.poll.pollId ? 'secondary' : 'quiet'}
                      fullWidth
                      aria-pressed={selectedPollId === item.poll.pollId}
                      onClick={() => setSelectedPollId(item.poll.pollId)}
                      sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          noWrap
                          fontWeight={foundationTokens.home.typography.weightBold}
                          variant="body2"
                        >
                          {item.poll.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`polls.states.${item.poll.state}`)}
                        </Typography>
                      </Box>
                    </ActionButton>
                  ))}
                  {pollsQuery.hasNextPage ? (
                    <ActionButton
                      intent="secondary"
                      loading={pollsQuery.isFetchingNextPage}
                      loadingLabel={t('polls.workspace.loadingMore')}
                      onClick={() => void pollsQuery.fetchNextPage()}
                    >
                      {t('actions.loadMore')}
                    </ActionButton>
                  ) : null}
                  {pollsQuery.isFetchNextPageError ? (
                    <InlineFeedback severity="warning">
                      {t('polls.workspace.loadMoreError')}
                    </InlineFeedback>
                  ) : null}
                  {invalidNextCursor ? (
                    <InlineFeedback severity="warning">
                      {t('polls.workspace.invalidCursor')}
                    </InlineFeedback>
                  ) : null}
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                  {t('polls.workspace.empty')}
                </Typography>
              )}
            </Box>

            <Box component="section" aria-label={t('polls.workspace.detailLabel')}>
              {!selectedPollId ? (
                <InlineFeedback severity="info">{t('polls.workspace.selectPoll')}</InlineFeedback>
              ) : detailsState === 'LOADING' ? (
                <Typography role="status">{t('polls.workspace.loadingDetail')}</Typography>
              ) : detailsState === 'DENIED' ? (
                <InlineFeedback severity="warning">{t('polls.workspace.denied')}</InlineFeedback>
              ) : detailsState === 'UNAVAILABLE' || !details ? (
                <InlineFeedback
                  severity="error"
                  action={
                    <ActionButton
                      intent="quiet"
                      startIcon={<RefreshCw size={16} aria-hidden="true" />}
                      onClick={() => void detailQuery.refetch()}
                    >
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('polls.workspace.detailUnavailable')}
                </InlineFeedback>
              ) : (
                <Stack spacing={2}>
                  {detailsState === 'STALE' ? (
                    <InlineFeedback severity="warning">
                      {t('polls.workspace.detailStale')}
                    </InlineFeedback>
                  ) : null}
                  {actions?.isOrganizer ? (
                    <>
                      {actions.canConfirm && calendarsQuery.isError ? (
                        <InlineFeedback severity="error">
                          {t('polls.workspace.calendarsUnavailable')}
                        </InlineFeedback>
                      ) : null}
                      <CalendarSchedulingPollOrganizer
                        details={details}
                        actorPersonPublicId={personPublicId}
                        calendars={calendars}
                        selectedCandidateId={selectedCandidateId}
                        selectedCalendarId={selectedCalendarId}
                        busyAction={busyOrganizerAction}
                        errorMessage={commandErrorMessage}
                        now={clockNow}
                        onCandidateChange={setSelectedCandidateId}
                        onCalendarChange={setSelectedCalendarId}
                        onOpen={(version) =>
                          openMutation.mutate({ pollId: details.poll.pollId, version })
                        }
                        onCancel={(version) =>
                          cancelMutation.mutate({ pollId: details.poll.pollId, version })
                        }
                        onConfirm={(input) =>
                          confirmMutation.mutate({ pollId: details.poll.pollId, ...input })
                        }
                      />
                    </>
                  ) : null}
                  {actions?.isParticipant ? (
                    <CalendarSchedulingPollParticipant
                      details={details}
                      actorPersonPublicId={personPublicId}
                      choices={voteChoices}
                      comment={voteComment}
                      submitting={voteMutation.isPending}
                      saved={savedVotePollId === details.poll.pollId}
                      errorMessage={commandErrorMessage}
                      now={clockNow}
                      onChoiceChange={(
                        candidateId: string,
                        choice: CalendarSchedulingPollVoteChoice
                      ) => {
                        setSavedVotePollId(null);
                        setVoteChoices((current) => ({ ...current, [candidateId]: choice }));
                      }}
                      onCommentChange={(value) => {
                        setSavedVotePollId(null);
                        setVoteComment(value);
                      }}
                      onSubmit={() =>
                        voteMutation.mutate({ details, choices: voteChoices, comment: voteComment })
                      }
                    />
                  ) : null}
                  {!actions?.isOrganizer && !actions?.isParticipant ? (
                    <InlineFeedback severity="warning">
                      {t('polls.workspace.detailDenied')}
                    </InlineFeedback>
                  ) : null}
                  <Typography variant="caption" color="text.secondary">
                    {t('polls.workspace.updatedAt', {
                      value:
                        formatCalendarSchedulingPollDateTime(
                          details.poll.updatedAt,
                          details.poll.timeZone,
                          language
                        ) ?? t('polls.dateUnavailable'),
                    })}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
