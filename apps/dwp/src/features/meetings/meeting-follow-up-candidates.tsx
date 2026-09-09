import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Eye, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  ContentDialog,
  ErrorState,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import { getVideoMeetingHome } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getLatestPublishedVideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import {
  createWorkAssignment,
  getWorkAssignmentBySource,
  getWorkAssignmentCommand,
} from '@dwp-frontend/shared-utils/api/work-assignment-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { meetingInsetSurface, meetingSurface } from './meeting-visual-system';
import { MeetingFollowUpEvidencePanel } from './meeting-follow-up-evidence-panel';

import {
  checkedCandidateAssignment,
  checkedCandidateCreation,
  projectMeetingFollowUpCandidates,
  type MeetingFollowUpCandidate,
} from './meeting-follow-up-candidates-model';
import { followUpAccessDenied } from './meeting-follow-ups-state';

type Attempt = { candidate: MeetingFollowUpCandidate; commandId: string };

export function MeetingFollowUpCandidates({
  identity,
  actorId,
  requestedCandidate,
}: {
  identity: string;
  actorId: number;
  requestedCandidate: string | null;
}) {
  const { t } = useTranslation('meetings');
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const client = useQueryClient();
  const mounted = useRef(true);
  const attempt = useRef<Attempt | null>(null);
  const pendingMobileConfirmation = useRef<MeetingFollowUpCandidate | null>(null);
  const [confirm, setConfirm] = useState<MeetingFollowUpCandidate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [completed, setCompleted] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const appliedNavigation = useRef<string | null>(null);
  const queryKey = useMemo(
    () => ['meetings', 'follow-ups', identity, 'candidates'] as const,
    [identity]
  );
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const home = await getVideoMeetingHome();
      const meetings = home.recent
        .filter(
          (meeting, index, all) =>
            all.findIndex((item) => item.meetingId === meeting.meetingId) === index
        )
        .slice(0, 4);
      const reports = await Promise.all(
        meetings.map((meeting) =>
          getLatestPublishedVideoMeetingIntelligenceReport(meeting.meetingId)
        )
      );
      return meetings
        .flatMap((meeting, index) =>
          projectMeetingFollowUpCandidates(meeting, reports[index], Date.now())
        )
        .slice(0, 20);
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attempt.current = null;
      pendingMobileConfirmation.current = null;
      client.removeQueries({ queryKey });
    };
  }, [client, queryKey]);
  const revoke = useCallback(() => {
    attempt.current = null;
    pendingMobileConfirmation.current = null;
    setConfirm(null);
    setBusyId(null);
    setUncertain(false);
    setCompleted({});
    setSelectedId(null);
    client.removeQueries({ queryKey });
  }, [client, queryKey]);
  useEffect(() => {
    if (followUpAccessDenied(query.error)) revoke();
  }, [query.error, revoke]);
  useEffect(() => {
    if (
      !query.isSuccess ||
      query.isFetching ||
      !requestedCandidate ||
      appliedNavigation.current === requestedCandidate
    )
      return;
    appliedNavigation.current = requestedCandidate;
    // The URL nominates a target; only the current bounded authorized list may select it.
    if (query.data.some((candidate) => candidate.source.candidateId === requestedCandidate))
      setSelectedId(requestedCandidate);
  }, [query.isSuccess, query.isFetching, query.data, requestedCandidate]);

  const resolveDuplicate = async (issued: Attempt) => {
    const task = checkedCandidateAssignment(
      await getWorkAssignmentBySource(issued.candidate.source),
      issued.candidate,
      actorId
    );
    if (!mounted.current) return;
    setCompleted((current) => ({
      ...current,
      [issued.candidate.source.candidateId]: task.assignmentId,
    }));
    attempt.current = null;
    setUncertain(false);
  };
  const run = async (issued: Attempt, mode: 'CREATE' | 'RETRY' | 'RECEIPT') => {
    if (busyId) return;
    setBusyId(issued.candidate.source.candidateId);
    try {
      const result =
        mode === 'RECEIPT'
          ? await getWorkAssignmentCommand(issued.commandId)
          : await createWorkAssignment(
              {
                source: issued.candidate.source,
                expectedSourceVersion: issued.candidate.sourceVersion,
              },
              issued.commandId
            );
      const checked = checkedCandidateCreation(result, issued.candidate, actorId, issued.commandId);
      if (!mounted.current) return;
      setCompleted((current) => ({
        ...current,
        [issued.candidate.source.candidateId]: checked.task.assignmentId,
      }));
      attempt.current = null;
      setUncertain(false);
      setConfirm(null);
    } catch (error) {
      if (!mounted.current) return;
      if (
        followUpAccessDenied(error) &&
        !(mode === 'RECEIPT' && error instanceof HttpError && error.status === 404)
      ) {
        revoke();
      } else if (error instanceof HttpError && error.status === 409) {
        try {
          await resolveDuplicate(issued);
        } catch (duplicateError) {
          if (
            followUpAccessDenied(duplicateError) &&
            !(duplicateError instanceof HttpError && duplicateError.status === 404)
          )
            revoke();
          else setUncertain(true);
        }
      } else {
        // A transport failure or missing receipt is not proof that CREATE did not commit.
        setUncertain(true);
      }
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };
  const create = () => {
    if (!confirm || attempt.current || busyId) return;
    const issued = { candidate: confirm, commandId: crypto.randomUUID() };
    attempt.current = issued;
    setConfirm(null);
    void run(issued, 'CREATE');
  };
  const requestCreation = (candidate: MeetingFollowUpCandidate) => {
    if (attempt.current || busyId || completed[candidate.source.candidateId]) return;
    setConfirm(candidate);
  };
  const requestMobileCreation = (candidate: MeetingFollowUpCandidate) => {
    if (
      attempt.current ||
      pendingMobileConfirmation.current ||
      busyId ||
      completed[candidate.source.candidateId]
    )
      return;
    // Close the full-screen review first so its focus trap cannot compete with confirmation.
    pendingMobileConfirmation.current = candidate;
    setSelectedId(null);
  };

  if (followUpAccessDenied(query.error)) {
    return (
      <ErrorState title={t('followUps.accessTitle')} description={t('followUps.accessHint')} />
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title={t('followUps.candidates.loadError')}
        description={t('followUps.candidates.loadErrorHint')}
        retryLabel={t('actions.retry')}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data)
    return <LoadingState label={t('followUps.candidates.loading')} skeletonRows={4} />;
  const selectedCandidate = query.data.find(
    (candidate) => candidate.source.candidateId === selectedId
  );
  return (
    <Stack gap={2} data-testid="meeting-follow-up-candidates">
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Sparkles size={20} aria-hidden="true" />
            <Typography component="h2" variant="h4">
              {t('followUps.candidateTitle')}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' }, mt: 0.75 }}
          >
            {t('followUps.candidateHint')}
          </Typography>
        </Box>
        <ActionIconButton
          label={t('actions.refresh')}
          onClick={() => query.refetch()}
          loading={query.isFetching}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
      {uncertain && attempt.current && (
        <InlineFeedback severity="warning" title={t('followUps.uncertainTitle')}>
          <Stack gap={1} alignItems="flex-start">
            <Typography variant="body2">{t('followUps.uncertainHint')}</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <ActionButton
                intent="secondary"
                onClick={() => void run(attempt.current!, 'RECEIPT')}
              >
                {t('followUps.checkReceipt')}
              </ActionButton>
              <ActionButton intent="primary" onClick={() => void run(attempt.current!, 'RETRY')}>
                {t('followUps.retrySameCommand')}
              </ActionButton>
            </Stack>
          </Stack>
        </InlineFeedback>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 7fr) minmax(0, 5fr)' },
          alignItems: 'start',
          gap: 2,
        }}
      >
        <Stack gap={1.5} sx={{ minWidth: 0, order: 1 }}>
          {query.data.length ? (
            query.data.map((candidate) => {
              const assignmentId = completed[candidate.source.candidateId];
              return (
                <Box
                  component="article"
                  key={candidate.source.candidateId}
                  sx={(currentTheme) => ({
                    ...meetingSurface(currentTheme),
                    p: 2,
                    borderLeft: 4,
                    borderLeftColor: 'success.main',
                    borderColor:
                      selectedId === candidate.source.candidateId ? 'primary.main' : undefined,
                  })}
                >
                  <Stack gap={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        icon={<Sparkles size={14} aria-hidden="true" />}
                        label={t('followUps.tabs.CANDIDATES')}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 1 }}
                      >
                        {candidate.meetingTitle}
                      </Typography>
                      <Typography
                        component="h3"
                        variant="h6"
                        fontWeight="fontWeightBold"
                        sx={{ mt: 1, overflowWrap: 'anywhere' }}
                      >
                        {candidate.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('followUps.candidates.confirmedSource')}
                      </Typography>
                    </Box>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="flex-end"
                      gap={1}
                    >
                      <ActionButton
                        intent="secondary"
                        aria-expanded={selectedId === candidate.source.candidateId}
                        onClick={() =>
                          setSelectedId(
                            selectedId === candidate.source.candidateId
                              ? null
                              : candidate.source.candidateId
                          )
                        }
                        startIcon={<Eye size={16} aria-hidden="true" />}
                        sx={{ minHeight: 44 }}
                      >
                        {selectedId === candidate.source.candidateId
                          ? t('followUps.candidates.closeReview')
                          : t('followUps.candidates.reviewCandidate')}
                      </ActionButton>
                      {assignmentId ? (
                        <Stack
                          direction="row"
                          alignItems="center"
                          gap={0.75}
                          sx={{ minHeight: 44 }}
                        >
                          <CheckCircle2 size={18} aria-hidden="true" />
                          <Typography variant="body2">
                            {t('followUps.candidates.created')}
                          </Typography>
                        </Stack>
                      ) : (
                        <ActionButton
                          intent="primary"
                          disabled={Boolean(attempt.current) || Boolean(busyId)}
                          loading={busyId === candidate.source.candidateId}
                          onClick={() => requestCreation(candidate)}
                          startIcon={<ClipboardList size={16} aria-hidden="true" />}
                          sx={{ minHeight: 44, flexShrink: 0 }}
                        >
                          {t('followUps.createCandidate')}
                        </ActionButton>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              );
            })
          ) : (
            <GuidedEmptyState
              kind="empty"
              title={t('followUps.candidates.emptyTitle')}
              description={t('followUps.candidates.emptyDescription')}
            />
          )}
        </Stack>
        <Stack
          component="aside"
          gap={1.5}
          sx={{ minWidth: 0, order: 2, position: { lg: 'sticky' }, top: { lg: 24 } }}
        >
          {desktop &&
            (selectedCandidate ? (
              <CandidateReview candidate={selectedCandidate} scope={identity} />
            ) : (
              <Box
                sx={{
                  p: 2.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: foundationTokens.radius.surface + 'px',
                  bgcolor: 'background.paper',
                }}
              >
                <Stack gap={1}>
                  <ClipboardList size={24} aria-hidden="true" />
                  <Typography component="h3" variant="subtitle1">
                    {t('followUps.candidates.reviewEmptyTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('followUps.candidates.reviewEmptyHint')}
                  </Typography>
                </Stack>
              </Box>
            ))}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', lg: 'block' } }}
          >
            {t('followUps.candidates.privacy')}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'block', lg: 'none' }, order: 3 }}
        >
          {t('followUps.candidates.privacy')}
        </Typography>
      </Box>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={t('followUps.candidates.confirmTitle')}
        description={t('followUps.candidates.confirmHint')}
        confirmLabel={t('followUps.candidates.confirmAction')}
        cancelLabel={t('actions.cancel')}
        busy={Boolean(busyId)}
        focusCancelAfterOpen
        minimumActionHeight={44}
        onClose={() => setConfirm(null)}
        onConfirm={create}
      />
      {!desktop && (
        <ContentDialog
          open={Boolean(selectedCandidate)}
          title={t('followUps.candidates.reviewTitle')}
          description={t('followUps.candidates.reviewHint')}
          closeLabel={t('followUps.candidates.closeReview')}
          onClose={() => setSelectedId(null)}
          fullScreen
          contentDividers
          contentSx={{ pt: 2 }}
          footerSx={{ px: 2, py: 1.5 }}
          slotProps={{
            transition: {
              onExited: () => {
                const pending = pendingMobileConfirmation.current;
                pendingMobileConfirmation.current = null;
                if (pending && mounted.current) setConfirm(pending);
              },
            },
          }}
          footerContent={
            selectedCandidate ? (
              completed[selectedCandidate.source.candidateId] ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="center"
                  gap={0.75}
                  role="status"
                  aria-live="polite"
                  sx={{ minHeight: 44, width: 1 }}
                >
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <Typography variant="body2">{t('followUps.candidates.created')}</Typography>
                </Stack>
              ) : (
                <ActionButton
                  data-testid="meeting-follow-up-candidate-create-mobile"
                  intent="primary"
                  fullWidth
                  disabled={Boolean(attempt.current) || Boolean(busyId)}
                  loading={busyId === selectedCandidate.source.candidateId}
                  onClick={() => requestMobileCreation(selectedCandidate)}
                  startIcon={<ClipboardList size={16} aria-hidden="true" />}
                  sx={{ minHeight: 44 }}
                >
                  {t('followUps.createCandidate')}
                </ActionButton>
              )
            ) : undefined
          }
        >
          {selectedCandidate && (
            <CandidateReview
              candidate={selectedCandidate}
              scope={identity}
              embedded
              showHeading={false}
            />
          )}
        </ContentDialog>
      )}
    </Stack>
  );
}

function CandidateReview({
  candidate,
  scope,
  embedded = false,
  showHeading = true,
}: {
  candidate: MeetingFollowUpCandidate;
  scope: string;
  embedded?: boolean;
  showHeading?: boolean;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box
      data-testid="meeting-follow-up-candidate-review"
      sx={{
        p: embedded ? 1.5 : 2.5,
        border: embedded ? 0 : 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: embedded ? 'action.hover' : 'background.paper',
      }}
    >
      <Stack gap={2}>
        {showHeading && (
          <Box>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <ShieldCheck size={18} aria-hidden="true" />
              <Typography component="h3" variant="subtitle1">
                {t('followUps.candidates.reviewTitle')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('followUps.candidates.reviewHint')}
            </Typography>
          </Box>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('followUps.candidates.reviewMeeting')}
          </Typography>
          <Typography variant="subtitle2">{candidate.meetingTitle}</Typography>
          <Typography variant="body2" sx={{ mt: 0.75 }}>
            {candidate.title}
          </Typography>
        </Box>
        <MeetingFollowUpEvidencePanel
          source={candidate.source}
          version={candidate.sourceVersion}
          scope={scope}
        />
        <Box sx={(currentTheme) => ({ ...meetingInsetSurface(currentTheme, 'primary'), p: 1.5 })}>
          <Typography variant="subtitle2">{t('followUps.candidates.impactTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('followUps.candidates.impactHint', { version: candidate.sourceVersion })}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
