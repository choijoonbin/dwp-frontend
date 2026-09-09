import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  CalendarClock,
  ChevronLeft,
  FileClock,
  FileText,
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, ErrorState, LoadingState } from '@dwp-frontend/design-system';
import {
  getVideoMeeting,
  type VideoMeetingArtifact,
  type VideoMeetingArtifactState,
  type VideoMeetingArtifactType,
  type VideoMeetingParticipant,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { useAuth } from '@dwp-frontend/shared-utils';
import { loadMeetingRecapReport } from './meeting-recap-source';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import { MeetingRecapTabs } from './meeting-recap-tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

import { formatMeetingDateTime } from './meeting-components';
import { MeetingArtifactPlayback } from './meeting-artifact-playback';
import { deriveMeetingArtifactPlaybackAvailability } from './meeting-artifact-playback-model';
import { MeetingIntelligenceReportSection } from './meeting-intelligence-report-section';
import { MeetingPlaybackSyncProvider } from './meeting-playback-sync';
import { MeetingTranscriptViewer } from './meeting-transcript-viewer';
import {
  derivePublishedMeetingRecap,
  type PublishedMeetingRecap,
} from './meeting-recap-intelligence-model';
import { meetingListSurface, meetingShape, meetingSurface } from './meeting-visual-system';
import { formatMeetingArtifactBytes, meetingParticipantOrder } from './meeting-recap-presentation';
import { MeetingRecapOutcome } from './meeting-recap-outcome';
import { OutcomeEmpty } from './meeting-recap-analysis';
import { MeetingRecapPipeline } from './meeting-recap-pipeline';
import { MeetingRecapMobileHeader } from './meeting-recap-mobile-header';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import { MeetingRecapDistribution } from './meeting-recap-distribution';

type RecapTab = 'overview' | 'artifacts' | 'follow-ups' | 'attendance';

const ARTIFACT_TYPES: readonly VideoMeetingArtifactType[] = [
  'RECORDING',
  'TRANSCRIPT',
  'SUMMARY',
  'ATTENDANCE',
  'CHAT_EXPORT',
];

const ARTIFACT_ICONS = {
  RECORDING: Radio,
  TRANSCRIPT: FileText,
  SUMMARY: Bot,
  ATTENDANCE: UsersRound,
  CHAT_EXPORT: FileClock,
} as const;

const ARTIFACT_STATUS_COLORS: Record<
  VideoMeetingArtifactState,
  'default' | 'info' | 'success' | 'warning' | 'error'
> = {
  NONE: 'default',
  PROCESSING: 'info',
  AVAILABLE: 'success',
  UNAVAILABLE: 'default',
  FAILED: 'error',
  DELETED: 'warning',
};

export function MeetingRecapDetail({
  meetingId,
  reportId,
  reviewReportId,
  onClose,
}: {
  meetingId: string;
  reportId?: string;
  reviewReportId?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const compact = useMediaQuery('(max-width: 599px)');
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  const [tab, setTab] = useState<RecapTab>(reviewReportId ? 'artifacts' : 'overview');
  const query = useQuery({
    queryKey: ['meetings', meetingId, 'recap', scope],
    queryFn: async () => {
      const meeting = await getVideoMeeting(meetingId);
      if (meeting.meetingId !== meetingId) throw new Error('Meeting recap binding mismatch.');
      return meeting;
    },
    enabled: isAuthenticated && Boolean(user),
    staleTime: 30_000,
    refetchInterval: (currentQuery) =>
      currentQuery.state.data?.artifacts.some((artifact) => artifact.artifactState === 'PROCESSING')
        ? 5_000
        : false,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const publishedRecapQuery = useQuery({
    queryKey: [
      'meetings',
      meetingId,
      'intelligence',
      'reports',
      reportId ?? 'latest-published',
      scope,
    ],
    queryFn: () => loadMeetingRecapReport(meetingId, reportId),
    enabled: isAuthenticated && Boolean(user) && Boolean(query.data) && !query.isError,
    staleTime: 30_000,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });

  if (!isAuthenticated || query.isLoading) {
    return <LoadingState label={t('history.recap.loading')} variant="skeleton" skeletonRows={8} />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={t('errors.loadTitle')}
        description={t('errors.loadDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => query.refetch()}
      />
    );
  }

  const meeting = query.data;
  const publishedRecap = derivePublishedMeetingRecap(
    publishedRecapQuery.data,
    publishedRecapQuery.isError || publishedRecapQuery.isRefetchError
  );
  if (reportId && (publishedRecapQuery.isPending || publishedRecapQuery.isFetching))
    return <LoadingState label={t('history.recap.intelligence.loading')} />;
  if (reportId && publishedRecap.state !== 'READY')
    return (
      <ErrorState
        title={t('context.sourceReportUnavailable')}
        description={t('context.sourceReportUnavailableHint')}
        retryLabel={t('actions.retry')}
        onRetry={() => publishedRecapQuery.refetch()}
      />
    );
  const actualDurationMinutes = (() => {
    if (!meeting.startedAt || !meeting.endedAt) return meeting.durationMinutes;
    const elapsed = Date.parse(meeting.endedAt) - Date.parse(meeting.startedAt);
    return Number.isFinite(elapsed) && elapsed >= 0
      ? Math.max(0, Math.ceil(elapsed / 60_000))
      : meeting.durationMinutes;
  })();
  const actualParticipantCount = meeting.participants.filter(
    (participant) =>
      participant.joinedAt ||
      participant.attendanceState === 'JOINED' ||
      participant.attendanceState === 'LEFT'
  ).length;
  const pipeline = (
    <MeetingRecapPipeline
      embedded={compact}
      recording={meeting.artifacts.some(
        (artifact) =>
          artifact.artifactType === 'RECORDING' && artifact.artifactState === 'AVAILABLE'
      )}
      transcript={meeting.artifacts.some(
        (artifact) =>
          artifact.artifactType === 'TRANSCRIPT' && artifact.artifactState === 'AVAILABLE'
      )}
      analysis={publishedRecap.state === 'READY'}
      approved={publishedRecap.state === 'READY' && Boolean(publishedRecapQuery.data?.approvedAt)}
      published={publishedRecap.state === 'READY'}
    />
  );
  return (
    <MeetingPlaybackSyncProvider>
      <Box component="article" aria-labelledby="meeting-recap-title" sx={{ minWidth: 0 }}>
        {(reportId || reviewReportId) && (
          <Typography role="status" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('context.sourceReportVersion', { id: reportId ?? reviewReportId })}
          </Typography>
        )}
        {compact ? (
          <MeetingRecapMobileHeader
            title={meeting.title}
            ended={t('history.recap.ended', {
              time: formatMeetingDateTime(meeting.endedAt ?? meeting.endsAt, i18n.language),
            })}
            access={t(`access.${meeting.accessScope}`)}
            evidence={t('history.recap.evidenceCount', {
              count: meeting.artifacts.filter((artifact) => artifact.artifactState === 'AVAILABLE')
                .length,
            })}
            duration={t('units.minutes', { count: actualDurationMinutes })}
            participants={t('units.participants', { count: actualParticipantCount })}
            refreshing={query.isFetching || publishedRecapQuery.isFetching}
            onClose={onClose}
            onRefresh={() => {
              void Promise.all([query.refetch(), publishedRecapQuery.refetch()]);
            }}
            pipeline={pipeline}
          />
        ) : (
          <>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'flex-start' }}
              gap={2}
              sx={(theme) => ({
                ...meetingSurface(theme),
                p: { xs: 2, md: 3 },
              })}
            >
              <Box sx={{ minWidth: 0 }}>
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<ChevronLeft size={16} aria-hidden="true" />}
                  onClick={onClose}
                  sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                >
                  {t('history.recap.back')}
                </ActionButton>
                <Typography
                  id="meeting-recap-title"
                  component="h1"
                  variant="h5"
                  fontWeight="fontWeightBold"
                  sx={{
                    mt: 1.25,
                    fontSize: { xs: 'h4.fontSize', md: 'h3.fontSize' },
                    lineHeight: 'h3.lineHeight',
                  }}
                >
                  {meeting.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('history.recap.ended', {
                    time: formatMeetingDateTime(meeting.endedAt ?? meeting.endsAt, i18n.language),
                  })}
                </Typography>
              </Box>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<RefreshCw size={15} aria-hidden="true" />}
                  loading={query.isFetching || publishedRecapQuery.isFetching}
                  loadingLabel={t('history.recap.refreshing')}
                  onClick={() => {
                    void Promise.all([query.refetch(), publishedRecapQuery.refetch()]);
                  }}
                >
                  {t('actions.refresh')}
                </ActionButton>
                <Chip
                  size="small"
                  icon={<ShieldCheck size={14} />}
                  label={t(`access.${meeting.accessScope}`)}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('history.recap.evidenceCount', {
                    count: meeting.artifacts.filter(
                      (artifact) => artifact.artifactState === 'AVAILABLE'
                    ).length,
                  })}
                />
              </Stack>
            </Stack>

            <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ my: 2 }}>
              <RecapMetric
                icon={CalendarClock}
                label={t('history.recap.metrics.duration')}
                value={t('units.minutes', { count: actualDurationMinutes })}
              />
              <RecapMetric
                icon={UsersRound}
                label={t('history.recap.metrics.participants')}
                value={t('units.participants', { count: actualParticipantCount })}
              />
            </Stack>
            {pipeline}
          </>
        )}

        <MeetingRecapTabs
          value={tab}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t('history.recap.tabs.label')}
          sx={{
            mt: { xs: 1.5, sm: 2.5 },
            minHeight: 48,
            p: 0.5,
            borderRadius: meetingShape.control,
            bgcolor: 'action.hover',
            '& .MuiTabs-flexContainer': {
              width: 'max-content',
              boxSizing: 'border-box',
              px: 0.75,
              py: 0.5,
            },
            '& .MuiTab-root': {
              minWidth: 90,
              minHeight: 44,
              flex: '0 0 auto',
              px: { xs: 1, sm: 2 },
              borderRadius: meetingShape.inset,
              whiteSpace: 'nowrap',
            },
            '& .MuiTab-root.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            },
            '& .MuiTabs-indicator': { display: 'none' },
          }}
          onChange={(_, value: RecapTab) => setTab(value)}
        >
          <Tab value="overview" label={t('history.recap.tabs.overview')} />
          <Tab value="artifacts" label={t('history.recap.tabs.artifacts')} />
          <Tab
            value="follow-ups"
            aria-controls={
              (tab === 'overview' || tab === 'follow-ups') &&
              !publishedRecapQuery.isLoading &&
              publishedRecap.state !== 'FAILED'
                ? 'meeting-recap-follow-ups'
                : undefined
            }
            label={`${t('history.recap.tabs.followUps')}${publishedRecap.state === 'READY' ? ` (${publishedRecap.actionItems.length})` : ''}`}
          />
          <Tab value="attendance" label={t('history.recap.tabs.attendance')} />
        </MeetingRecapTabs>

        <Box sx={{ pt: { xs: 1.5, sm: 2.5 } }}>
          {(tab === 'overview' || tab === 'follow-ups') && (
            <MeetingOutcome
              meeting={meeting}
              recap={publishedRecap}
              report={publishedRecapQuery.data}
              loading={publishedRecapQuery.isLoading}
              focusFollowUps={tab === 'follow-ups'}
              onRetry={() => {
                void publishedRecapQuery.refetch();
              }}
            />
          )}
          {tab === 'artifacts' && (
            <Stack gap={3}>
              {reviewReportId && (
                <MeetingIntelligenceReportSection
                  meetingId={meeting.meetingId}
                  canHost={meeting.canHost}
                  artifacts={meeting.artifacts}
                  reportId={reviewReportId}
                />
              )}
              <ArtifactCustody meetingId={meeting.meetingId} artifacts={meeting.artifacts} />
              <Divider />
              {!reportId && !reviewReportId && (
                <MeetingIntelligenceReportSection
                  meetingId={meeting.meetingId}
                  canHost={meeting.canHost}
                  artifacts={meeting.artifacts}
                />
              )}
            </Stack>
          )}
          {tab === 'attendance' && (
            <AttendanceEvidence
              participants={meeting.participants}
              accessScope={meeting.accessScope}
            />
          )}
        </Box>

        {tab === 'overview' && publishedRecap.state === 'READY' && publishedRecapQuery.data && (
          <MeetingRecapDistribution
            key={`${publishedRecapQuery.data.reportId}:${publishedRecapQuery.data.version}`}
            meetingId={meeting.meetingId}
            report={publishedRecapQuery.data}
          />
        )}
      </Box>
    </MeetingPlaybackSyncProvider>
  );
}

function MeetingOutcome({
  meeting,
  recap,
  report,
  loading,
  focusFollowUps,
  onRetry,
}: {
  meeting: Awaited<ReturnType<typeof getVideoMeeting>>;
  recap: PublishedMeetingRecap;
  report?: VideoMeetingIntelligenceReport | null;
  loading: boolean;
  focusFollowUps: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('meetings');
  if (loading) {
    return (
      <LoadingState
        label={t('history.recap.intelligence.loading')}
        variant="skeleton"
        skeletonRows={5}
      />
    );
  }
  if (recap.state === 'FAILED') {
    return (
      <ErrorState
        title={t('history.recap.intelligence.loadErrorTitle')}
        description={t('history.recap.intelligence.loadErrorDescription')}
        retryLabel={t('history.recap.intelligence.retry')}
        onRetry={onRetry}
      />
    );
  }
  return (
    <MeetingRecapOutcome
      meetingId={meeting.meetingId}
      recap={recap}
      report={report}
      agenda={meeting.agenda}
      focusFollowUps={focusFollowUps}
      evidence={
        <RecapEvidenceRail
          meetingId={meeting.meetingId}
          artifacts={meeting.artifacts}
          recap={recap}
        />
      }
    />
  );
}

function RecapEvidenceRail({
  meetingId,
  artifacts,
  recap,
}: {
  meetingId: string;
  artifacts: VideoMeetingArtifact[];
  recap: PublishedMeetingRecap;
}) {
  const { t, i18n } = useTranslation('meetings');
  const compact = useMediaQuery('(max-width: 599px)');
  const [showTranscript, setShowTranscript] = useState(false);
  const byType = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.artifactType, artifact])),
    [artifacts]
  );
  const recording = byType.get('RECORDING');
  const transcript = byType.get('TRANSCRIPT');
  return (
    <Box
      component="aside"
      aria-labelledby="meeting-recap-evidence-title"
      data-testid="meeting-recap-evidence-rail"
      sx={(theme) => ({
        ...meetingSurface(theme, { elevated: false }),
        minWidth: 0,
        p: { xs: 2, sm: 2.5 },
        position: { lg: 'sticky' },
        top: { lg: 16 },
      })}
    >
      <Stack gap={2}>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Typography
            id="meeting-recap-evidence-title"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('history.recap.evidenceRail.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('history.recap.evidenceRail.description')}
          </Typography>
        </Box>
        <Box
          sx={(theme) => ({
            minHeight: { xs: 64, sm: 168 },
            display: 'grid',
            placeItems: 'center',
            px: 2,
            py: { xs: 1.25, sm: 3 },
            borderRadius: 'var(--dwp-shape-borderRadius)',
            backgroundColor: theme.palette.common.black,
            color: theme.palette.common.white,
            textAlign: 'center',
            '@media (forced-colors: active)': {
              bgcolor: 'Canvas',
              color: 'CanvasText',
              border: '1px solid CanvasText',
            },
          })}
        >
          <Stack alignItems="center" gap={1}>
            <Radio size={26} aria-hidden="true" />
            <Typography variant="subtitle2" fontWeight="fontWeightBold" color="inherit">
              {recording?.artifactState === 'AVAILABLE'
                ? t('history.recap.evidenceRail.recordingReady')
                : t('history.recap.evidenceRail.recordingUnavailable')}
            </Typography>
            <Typography
              variant="caption"
              color="inherit"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {t('history.recap.evidenceRail.playbackHint')}
            </Typography>
          </Stack>
        </Box>
        {recording && <MeetingArtifactPlayback meetingId={meetingId} artifact={recording} />}
        {transcript?.artifactState === 'AVAILABLE' && (
          <>
            <Divider />
            {compact && (
              <ActionButton
                intent="quiet"
                aria-expanded={showTranscript}
                onClick={() => setShowTranscript((value) => !value)}
              >
                {t('designReview.recap.showEvidenceDetails')}
              </ActionButton>
            )}
            {(!compact || showTranscript) && (
              <MeetingTranscriptViewer meetingId={meetingId} artifact={transcript} />
            )}
          </>
        )}
        <Divider />
        <Stack gap={1.25} sx={{ display: { xs: 'none', sm: 'flex' } }}>
          <EvidenceStatusRow
            icon={Radio}
            label={t('history.recap.artifacts.types.RECORDING')}
            state={recording?.artifactState ?? 'UNAVAILABLE'}
          />
          <EvidenceStatusRow
            icon={FileText}
            label={t('history.recap.artifacts.types.TRANSCRIPT')}
            state={transcript?.artifactState ?? 'UNAVAILABLE'}
          />
          <EvidenceStatusRow
            icon={Bot}
            label={t('history.recap.evidenceRail.reviewedNotes')}
            state={recap.state === 'READY' ? 'AVAILABLE' : 'UNAVAILABLE'}
          />
        </Stack>
        {recording?.retentionUntil && (
          <Stack direction="row" gap={0.75} alignItems="flex-start" color="text.secondary">
            <LockKeyhole size={15} aria-hidden="true" style={{ marginTop: 2, flex: '0 0 auto' }} />
            <Typography variant="caption">
              {t('history.recap.artifacts.retention', {
                time: formatMeetingDateTime(recording.retentionUntil, i18n.language),
              })}
            </Typography>
          </Stack>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' } }}
        >
          {t('history.recap.evidenceRail.transcriptHint')}
        </Typography>
      </Stack>
    </Box>
  );
}

function EvidenceStatusRow({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof Radio;
  label: string;
  state: VideoMeetingArtifactState;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon size={16} aria-hidden="true" />
      <Typography variant="body2" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Chip
        size="small"
        color={ARTIFACT_STATUS_COLORS[state]}
        variant={state === 'UNAVAILABLE' ? 'outlined' : 'filled'}
        label={t(`history.recap.artifacts.states.${state}`)}
      />
    </Stack>
  );
}

function ArtifactCustody({
  meetingId,
  artifacts,
}: {
  meetingId: string;
  artifacts: VideoMeetingArtifact[];
}) {
  const { t, i18n } = useTranslation('meetings');
  const byType = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.artifactType, artifact])),
    [artifacts]
  );
  const processing = artifacts.some((artifact) => artifact.artifactState === 'PROCESSING');
  const storedWithoutRetrieval = artifacts.some(
    (artifact) =>
      artifact.artifactState === 'AVAILABLE' &&
      deriveMeetingArtifactPlaybackAvailability(artifact).state !== 'READY'
  );
  return (
    <Stack gap={2}>
      <Alert
        severity="info"
        icon={<LockKeyhole size={19} />}
        sx={{ '& .MuiAlert-message': { overflow: 'visible' } }}
      >
        {t('history.recap.artifacts.governance')}
      </Alert>
      {processing && (
        <Alert severity="info" role="status">
          {t('history.recap.artifacts.processingRefresh')}
        </Alert>
      )}
      {storedWithoutRetrieval && (
        <Alert severity="warning" sx={{ '& .MuiAlert-message': { overflow: 'visible' } }}>
          {t('history.recap.artifacts.retrievalUnavailable')}
        </Alert>
      )}
      <Box sx={(theme) => meetingListSurface(theme)}>
        {ARTIFACT_TYPES.map((type) => {
          const artifact = byType.get(type);
          const state = artifact?.artifactState ?? 'UNAVAILABLE';
          const Icon = ARTIFACT_ICONS[type];
          const size = formatMeetingArtifactBytes(artifact?.sizeBytes);
          const playback = artifact
            ? deriveMeetingArtifactPlaybackAvailability(artifact)
            : { state: 'NOT_AVAILABLE' as const };
          return (
            <Box key={type}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                gap={1.5}
                sx={{ p: 2 }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: meetingShape.inset,
                    color: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09),
                  }}
                >
                  <Icon size={19} aria-hidden="true" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight="fontWeightBold">
                    {t(`history.recap.artifacts.types.${type}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {artifact?.retentionUntil
                      ? t('history.recap.artifacts.retention', {
                          time: formatMeetingDateTime(artifact.retentionUntil, i18n.language),
                        })
                      : t('history.recap.artifacts.noRetention')}
                    {size ? ` · ${size}` : ''}
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1}
                  sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 0 }}
                >
                  <Chip
                    size="small"
                    color={ARTIFACT_STATUS_COLORS[state]}
                    variant={state === 'UNAVAILABLE' ? 'outlined' : 'filled'}
                    label={t(
                      state === 'AVAILABLE' && playback.state !== 'READY'
                        ? 'history.recap.artifacts.states.AVAILABLE_NO_RETRIEVAL'
                        : `history.recap.artifacts.states.${state}`
                    )}
                  />
                  {artifact && (
                    <MeetingArtifactPlayback meetingId={meetingId} artifact={artifact} />
                  )}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}

function AttendanceEvidence({
  participants,
  accessScope,
}: {
  participants: VideoMeetingParticipant[];
  accessScope: string;
}) {
  const { t } = useTranslation('meetings');
  const ordered = [...participants].sort(
    (left, right) =>
      meetingParticipantOrder(left) - meetingParticipantOrder(right) ||
      left.displayName.localeCompare(right.displayName)
  );
  return (
    <Stack gap={2}>
      <Alert severity="info" icon={<ShieldCheck size={19} />}>
        {t('history.recap.attendanceGovernance', { access: t(`access.${accessScope}`) })}
      </Alert>
      <Box sx={(theme) => meetingListSurface(theme)}>
        {ordered.length ? (
          ordered.map((participant) => (
            <Box key={participant.participantId}>
              <Stack direction="row" alignItems="center" gap={1.5} sx={{ p: 1.75 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 36,
                    height: 36,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    bgcolor: 'action.hover',
                    fontWeight: 'fontWeightBold',
                  }}
                >
                  {Array.from(participant.displayName)[0] || '?'}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight="fontWeightBold" noWrap>
                    {participant.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {participant.organizationName || participant.emailAddress || '—'}
                  </Typography>
                </Box>
                <Stack alignItems="flex-end" gap={0.5}>
                  <Chip size="small" label={t(`room.roles.${participant.participantRole}`)} />
                  <Typography variant="caption" color="text.secondary">
                    {t(`history.recap.attendanceStates.${participant.attendanceState}`)}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          ))
        ) : (
          <OutcomeEmpty text={t('history.recap.attendanceEmpty')} />
        )}
      </Box>
    </Stack>
  );
}

function RecapMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon size={17} aria-hidden="true" />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography fontWeight="fontWeightBold" noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
