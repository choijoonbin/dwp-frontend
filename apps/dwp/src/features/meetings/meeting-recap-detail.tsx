import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
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
import { getLatestPublishedVideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

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
import { MeetingIntelligenceReportSection } from './meeting-intelligence-report-section';
import {
  derivePublishedMeetingRecap,
  type PublishedMeetingRecap,
} from './meeting-recap-intelligence-model';

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

function formatBytes(value?: number | null): string | null {
  if (value == null || value < 0) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function participantOrder(participant: VideoMeetingParticipant): number {
  return {
    ORGANIZER: 0,
    CO_HOST: 1,
    PRESENTER: 2,
    ATTENDEE: 3,
    GUEST: 4,
  }[participant.participantRole];
}

export function MeetingRecapDetail({
  meetingId,
  onClose,
}: {
  meetingId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const [tab, setTab] = useState<RecapTab>('overview');
  const query = useQuery({
    queryKey: ['meetings', meetingId, 'recap'],
    queryFn: () => getVideoMeeting(meetingId),
    staleTime: 30_000,
    refetchInterval: (currentQuery) =>
      currentQuery.state.data?.artifacts.some((artifact) => artifact.artifactState === 'PROCESSING')
        ? 5_000
        : false,
    retry: 1,
  });
  const publishedRecapQuery = useQuery({
    queryKey: ['meetings', meetingId, 'intelligence', 'reports', 'latest-published'],
    queryFn: () => getLatestPublishedVideoMeetingIntelligenceReport(meetingId),
    staleTime: 30_000,
    retry: 1,
  });

  if (query.isLoading) {
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
    <Box component="article" aria-labelledby="meeting-recap-title" sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        gap={2}
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
            fontWeight={850}
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
              count: meeting.artifacts.filter((artifact) => artifact.artifactState === 'AVAILABLE')
                .length,
            })}
          />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          mt: 2.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
          '& > *': { p: 1.5, minWidth: 0 },
          '& > *:not(:last-child)': { borderRight: 1, borderColor: 'divider' },
        }}
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
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTabs-flexContainer': { width: { xs: '100%', sm: 'auto' } },
          '& .MuiTab-root': {
            minWidth: { xs: 0, sm: 90 },
            flex: { xs: '1 1 0', sm: '0 0 auto' },
            px: { xs: 1, sm: 2 },
            whiteSpace: 'nowrap',
          },
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
            <ArtifactCustody artifacts={meeting.artifacts} />
            <Divider />
            <MeetingIntelligenceReportSection
              meetingId={meeting.meetingId}
              canHost={meeting.canHost}
              artifacts={meeting.artifacts}
            />
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
    <Stack gap={2.5}>
      <Alert severity={available ? 'success' : 'info'} icon={<Bot size={19} />}>
        <Typography fontWeight={800}>
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
        <RecapSection title={t('history.recap.decisionsTitle')}>
          {recap.decisions.length ? (
            <Stack component="ol" gap={1.25} sx={{ m: 0, pl: 2.5 }}>
              {recap.decisions.map((decision, index) => (
                <Box component="li" key={`${decision}-${index}`}>
                  <Typography fontWeight={750}>{decision}</Typography>
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
                  <Typography fontWeight={750}>{action}</Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <OutcomeEmpty text={t('history.recap.actionsEmpty')} />
          )}
        </RecapSection>
      </Box>
    </Stack>
  );
}

function ArtifactCustody({ artifacts }: { artifacts: VideoMeetingArtifact[] }) {
  const { t, i18n } = useTranslation('meetings');
  const byType = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.artifactType, artifact])),
    [artifacts]
  );
  const processing = artifacts.some((artifact) => artifact.artifactState === 'PROCESSING');
  const storedWithoutRetrieval = artifacts.some(
    (artifact) => artifact.artifactState === 'AVAILABLE'
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
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {ARTIFACT_TYPES.map((type, index) => {
          const artifact = byType.get(type);
          const state = artifact?.artifactState ?? 'UNAVAILABLE';
          const Icon = ARTIFACT_ICONS[type];
          const size = formatBytes(artifact?.sizeBytes);
          return (
            <Box key={type}>
              {index > 0 && <Divider />}
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
                    borderRadius: 1,
                    color: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09),
                  }}
                >
                  <Icon size={19} aria-hidden="true" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={800}>
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
                <Chip
                  size="small"
                  color={ARTIFACT_STATUS_COLORS[state]}
                  variant={state === 'UNAVAILABLE' ? 'outlined' : 'filled'}
                  label={t(
                    state === 'AVAILABLE'
                      ? 'history.recap.artifacts.states.AVAILABLE_NO_RETRIEVAL'
                      : `history.recap.artifacts.states.${state}`
                  )}
                />
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
      participantOrder(left) - participantOrder(right) ||
      left.displayName.localeCompare(right.displayName)
  );
  return (
    <Stack gap={2}>
      <Alert severity="info" icon={<ShieldCheck size={19} />}>
        {t('history.recap.attendanceGovernance', { access: t(`access.${accessScope}`) })}
      </Alert>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {ordered.length ? (
          ordered.map((participant, index) => (
            <Box key={participant.participantId}>
              {index > 0 && <Divider />}
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
                    fontWeight: 850,
                  }}
                >
                  {Array.from(participant.displayName)[0] || '?'}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={750} noWrap>
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
        <Typography fontWeight={850} noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function RecapSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      sx={{
        height: '100%',
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Typography component="h3" variant="subtitle1" fontWeight={850} sx={{ mb: 1.25 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function OutcomeEmpty({ text }: { text: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={1} color="text.secondary" sx={{ py: 1 }}>
      <CircleAlert size={17} aria-hidden="true" />
      <Typography variant="body2">{text}</Typography>
    </Stack>
  );
}
