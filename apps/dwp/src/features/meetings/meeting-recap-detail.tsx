import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  FileClock,
  FileText,
  ListChecks,
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
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
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
import { meetingListSurface, meetingSurface } from './meeting-visual-system';
import { formatMeetingArtifactBytes, meetingParticipantOrder } from './meeting-recap-presentation';
import { MeetingRecapAnalysis, OutcomeEmpty, RecapSection } from './meeting-recap-analysis';

type RecapTab = 'overview' | 'artifacts' | 'attendance';

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
  const outcomeCount = (items: string[]) =>
    publishedRecapQuery.isLoading || publishedRecap.state === 'FAILED' ? '—' : String(items.length);
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
  return (
    <MeetingPlaybackSyncProvider>
      <Box component="article" aria-labelledby="meeting-recap-title" sx={{ minWidth: 0 }}>
        {(reportId || reviewReportId) && (
          <Typography role="status" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('context.sourceReportVersion', { id: reportId ?? reviewReportId })}
          </Typography>
        )}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'flex-start' }}
          gap={2}
          sx={(theme) => ({
            ...meetingSurface(theme, { tone: 'primary' }),
            p: { xs: 2, md: 3 },
          })}
        >
          <Box sx={{ minWidth: 0 }}>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<ChevronLeft size={16} aria-hidden="true" />}
              onClick={onClose}
            >
              {t('history.recap.back')}
            </ActionButton>
            <Typography
              id="meeting-recap-title"
              component="h2"
              variant="h5"
              fontWeight="fontWeightBold"
              sx={{ mt: 1.25 }}
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

        <Box
          sx={(theme) => ({
            ...meetingSurface(theme, { elevated: false }),
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            mt: 2,
            '& > *': {
              p: 1.5,
              minWidth: 0,
              borderColor: 'divider',
              borderRight: 1,
              borderBottom: { xs: 1, lg: 0 },
            },
            '& > :nth-of-type(2n)': {
              borderRight: { xs: 0, lg: 1 },
            },
            '& > :nth-of-type(n + 3)': {
              borderBottom: { xs: 0, lg: 0 },
            },
            '& > :last-child': {
              borderRight: 0,
            },
          })}
        >
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
          <RecapMetric
            icon={ListChecks}
            label={t('history.recap.metrics.decisions')}
            value={outcomeCount(publishedRecap.decisions)}
          />
          <RecapMetric
            icon={CheckCircle2}
            label={t('history.recap.metrics.actions')}
            value={outcomeCount(publishedRecap.actionItems)}
          />
        </Box>

        <Tabs
          value={tab}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t('history.recap.tabs.label')}
          sx={{
            mt: 2.5,
            minHeight: 48,
            p: 0.5,
            borderRadius: 2.5,
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
              borderRadius: 2,
              whiteSpace: 'nowrap',
            },
            '& .Mui-selected': { bgcolor: 'background.paper' },
            '& .MuiTabs-indicator': { display: 'none' },
          }}
          onChange={(_, value: RecapTab) => setTab(value)}
        >
          <Tab value="overview" label={t('history.recap.tabs.overview')} />
          <Tab value="artifacts" label={t('history.recap.tabs.artifacts')} />
          <Tab value="attendance" label={t('history.recap.tabs.attendance')} />
        </Tabs>

        <Box sx={{ pt: 2.5 }}>
          {tab === 'overview' && (
            <MeetingOutcome
              meeting={meeting}
              recap={publishedRecap}
              loading={publishedRecapQuery.isLoading}
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
      </Box>
    </MeetingPlaybackSyncProvider>
  );
}

function MeetingOutcome({
  meeting,
  recap,
  loading,
  onRetry,
}: {
  meeting: Awaited<ReturnType<typeof getVideoMeeting>>;
  recap: PublishedMeetingRecap;
  loading: boolean;
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
  const available = recap.state === 'READY';
  return (
    <Box
      data-testid="meeting-recap-overview"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,7fr) minmax(320px,5fr)' },
        gridTemplateAreas: {
          xs: '"summary" "evidence" "analysis"',
          lg: '"summary evidence" "analysis evidence"',
        },
        columnGap: 3,
        rowGap: { xs: 2.5, lg: 0 },
        alignItems: 'start',
      }}
    >
      <Stack
        gap={0}
        sx={(theme) => ({
          ...meetingSurface(theme, { elevated: false }),
          gridArea: 'summary',
          minWidth: 0,
          overflow: 'hidden',
          borderBottom: { lg: available ? 0 : undefined },
          borderBottomLeftRadius: { lg: available ? 0 : undefined },
          borderBottomRightRadius: { lg: available ? 0 : undefined },
        })}
      >
        <Alert
          severity={available ? 'success' : 'info'}
          icon={<Bot size={19} />}
          sx={{ border: 0, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography fontWeight="fontWeightBold">
            {t(available ? 'history.recap.ai.readyTitle' : 'history.recap.ai.unavailableTitle')}
          </Typography>
          <Typography variant="body2">
            {t(
              available
                ? 'history.recap.ai.readyDescription'
                : 'history.recap.ai.unavailableDescription'
            )}
          </Typography>
        </Alert>

        {available && (
          <RecapSection title={t('history.recap.intelligence.sections.executiveSummary')}>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{recap.summary}</Typography>
          </RecapSection>
        )}

        <RecapSection title={t('history.recap.agendaTitle')}>
          <Typography color={meeting.agenda ? 'text.primary' : 'text.secondary'}>
            {meeting.agenda || t('room.agendaEmpty')}
          </Typography>
        </RecapSection>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' },
            borderTop: 1,
            borderColor: 'divider',
            '& > section': { borderTop: 0 },
            '& > section + section': {
              borderTop: { xs: 1, xl: 0 },
              borderLeft: { xs: 0, xl: 1 },
              borderColor: 'divider',
            },
          }}
        >
          <RecapSection title={t('history.recap.decisionsTitle')}>
            {recap.decisions.length ? (
              <Stack component="ol" gap={1.25} sx={{ m: 0, pl: 2.5 }}>
                {recap.decisions.map((decision, index) => (
                  <Box component="li" key={`${decision}-${index}`}>
                    <Typography fontWeight="fontWeightBold">{decision}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <OutcomeEmpty text={t('history.recap.decisionsEmpty')} />
            )}
          </RecapSection>

          <RecapSection title={t('history.recap.actionsTitle')}>
            {recap.actionItems.length ? (
              <Stack component="ol" gap={1.25} sx={{ m: 0, pl: 2.5 }}>
                {recap.actionItems.map((action, index) => (
                  <Box component="li" key={`${action}-${index}`}>
                    <Typography fontWeight="fontWeightBold">{action}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <OutcomeEmpty text={t('history.recap.actionsEmpty')} />
            )}
          </RecapSection>
        </Box>
      </Stack>
      <Box sx={{ gridArea: 'evidence', minWidth: 0 }}>
        <RecapEvidenceRail
          meetingId={meeting.meetingId}
          artifacts={meeting.artifacts}
          recap={recap}
        />
      </Box>
      {available && <MeetingRecapAnalysis recap={recap} />}
    </Box>
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
        <Box>
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
            minHeight: 168,
            display: 'grid',
            placeItems: 'center',
            px: 2,
            py: 3,
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
            <Typography variant="caption" color="inherit">
              {t('history.recap.evidenceRail.playbackHint')}
            </Typography>
          </Stack>
        </Box>
        {recording && <MeetingArtifactPlayback meetingId={meetingId} artifact={recording} />}
        {transcript?.artifactState === 'AVAILABLE' && (
          <>
            <Divider />
            <MeetingTranscriptViewer meetingId={meetingId} artifact={transcript} />
          </>
        )}
        <Divider />
        <Stack gap={1.25}>
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
        <Typography variant="caption" color="text.secondary">
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
                    borderRadius: 2,
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
