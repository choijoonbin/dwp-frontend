import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Clock3,
  FileClock,
  Gauge,
  Play,
  Radio,
  Search,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  ErrorState,
  foundationTokens,
  FormField,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingHistory,
  type VideoMeetingHistoryItem,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getLatestPublishedVideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import { useSearchParams } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ProductSurfaceLocalNotFound } from '../../components/product-surface-local-not-found';
import { formatMeetingDateTime, MeetingPageHeading } from './meeting-components';
import { MeetingRecapDetail } from './meeting-recap-detail';
import { meetingRecapReference } from './meeting-recap-source';
import { meetingListSurface, meetingSurface } from './meeting-visual-system';

type HistoryEvidenceFilter = 'ALL' | 'RECORDING' | 'TRANSCRIPT' | 'NO_MEDIA';
type HistoryRoleFilter = 'ALL' | 'HOST' | 'ATTENDEE';

export const MEETING_HISTORY_PAGE_SIZE = 10;

export function meetingHistoryPageCount(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

export function filterMeetingHistoryPage(
  meetings: VideoMeetingHistoryItem[],
  search: string,
  evidence: HistoryEvidenceFilter,
  role: HistoryRoleFilter = 'ALL'
): VideoMeetingHistoryItem[] {
  const query = search.trim().toLocaleLowerCase();
  return meetings.filter((meeting) => {
    if (evidence === 'RECORDING' && !meeting.recordingAvailable) return false;
    if (evidence === 'TRANSCRIPT' && !meeting.transcriptAvailable) return false;
    if (evidence === 'NO_MEDIA' && (meeting.recordingAvailable || meeting.transcriptAvailable))
      return false;
    if (role === 'HOST' && !meeting.canHost) return false;
    if (role === 'ATTENDEE' && meeting.canHost) return false;
    if (!query) return true;
    return [meeting.title, meeting.organizerName].some((value) =>
      value.toLocaleLowerCase().includes(query)
    );
  });
}

export function MeetingHistory() {
  const { t } = useTranslation('meetings');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [evidence, setEvidence] = useState<HistoryEvidenceFilter>('ALL');
  const [role, setRole] = useState<HistoryRoleFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReference = meetingRecapReference(searchParams.toString());
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  const query = useQuery({
    queryKey: ['meetings', 'history', scope, page],
    queryFn: () => getVideoMeetingHistory(page, MEETING_HISTORY_PAGE_SIZE),
    staleTime: 30_000,
    retry: false,
    gcTime: 0,
    enabled: isAuthenticated && Boolean(user) && selectedReference === null,
    meta: { accessSensitive: true },
  });
  const filtered = useMemo(
    () => filterMeetingHistoryPage(query.data?.items ?? [], search, evidence, role),
    [evidence, query.data?.items, role, search]
  );
  const evidenceCounts = useMemo(() => {
    const meetings = query.data?.items ?? [];
    return {
      ALL: meetings.length,
      RECORDING: meetings.filter((meeting) => meeting.recordingAvailable).length,
      TRANSCRIPT: meetings.filter((meeting) => meeting.transcriptAvailable).length,
      NO_MEDIA: meetings.filter(
        (meeting) => !meeting.recordingAvailable && !meeting.transcriptAvailable
      ).length,
    };
  }, [query.data?.items]);
  const selected = filtered.find((meeting) => meeting.meetingId === selectedId) ?? filtered[0];
  const openRecap = (meetingId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('meeting', meetingId);
    setSearchParams(next);
  };

  if (selectedReference === 'invalid') return <ProductSurfaceLocalNotFound />;
  if (selectedReference) {
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <MeetingRecapDetail
          key={scope + JSON.stringify(selectedReference)}
          meetingId={selectedReference.meetingId}
          reportId={selectedReference.intent === 'review' ? undefined : selectedReference.reportId}
          reviewReportId={
            selectedReference.intent === 'review' ? selectedReference.reportId : undefined
          }
          onClose={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('meeting');
            next.delete('reportId');
            next.delete('intent');
            setSearchParams(next, { replace: true });
          }}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <MeetingPageHeading
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        description={t('history.description')}
        density="compact"
      />
      <Alert
        severity="info"
        icon={<FileClock size={18} />}
        sx={{ mb: 2, py: 0.25, borderRadius: 2 }}
      >
        {t('history.recordingGovernance')}
      </Alert>

      <Box
        component="section"
        aria-label={t('history.filters.label')}
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tabs
          value={evidence}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t('history.filters.evidenceLabel')}
          onChange={(_, value: HistoryEvidenceFilter) => setEvidence(value)}
          sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, px: { xs: 1.5, sm: 2 } } }}
        >
          {(['ALL', 'RECORDING', 'TRANSCRIPT', 'NO_MEDIA'] as const).map((value) => (
            <Tab
              key={value}
              value={value}
              label={`${t(`history.filters.evidence.${value}`)} ${evidenceCounts[value]}`}
            />
          ))}
        </Tabs>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'minmax(0, 1fr) minmax(180px, .4fr)',
            },
            gap: 1.5,
            py: 2,
          }}
        >
          <FormField
            size="small"
            label={t('history.filters.search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <SelectField
            size="small"
            label={t('history.filters.roleLabel')}
            value={role}
            onValueChange={(value) => setRole(value as HistoryRoleFilter)}
            options={(['ALL', 'HOST', 'ATTENDEE'] as const).map((value) => ({
              value,
              label: t(`history.filters.role.${value}`),
            }))}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ gridColumn: '1 / -1', maxWidth: 520 }}
          >
            {t('history.filters.pageScope')}
          </Typography>
        </Box>
      </Box>

      {!isAuthenticated || query.isLoading ? (
        <LoadingState label={t('history.loading')} variant="skeleton" skeletonRows={6} />
      ) : query.isError || !query.data ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : query.data.items.length ? (
        <>
          <Typography variant="body2" fontWeight="fontWeightBold" sx={{ mb: 1.5 }}>
            {t('history.filters.resultCount', { count: filtered.length })}
          </Typography>
          <Box
            data-testid="meeting-library-workspace"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0,1fr)',
                lg: 'minmax(0,7fr) minmax(320px,5fr)',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box data-testid="meeting-library-list" sx={(theme) => meetingListSurface(theme)}>
              {filtered.length ? (
                filtered.map((meeting) => (
                  <MeetingHistoryRow
                    key={meeting.meetingId}
                    meeting={meeting}
                    selected={selected?.meetingId === meeting.meetingId}
                    onSelect={() => setSelectedId(meeting.meetingId)}
                    onOpen={() => openRecap(meeting.meetingId)}
                  />
                ))
              ) : (
                <GuidedEmptyState
                  kind="no-results"
                  size="compact"
                  title={t('history.filters.noMatches')}
                  description={t('history.filters.noMatchesDescription')}
                />
              )}
            </Box>
            <Box
              component="aside"
              aria-label={t('history.preview.label')}
              data-testid="meeting-library-preview"
              sx={(theme) => ({
                ...meetingSurface(theme, { elevated: false }),
                display: { xs: 'none', lg: 'block' },
                position: 'sticky',
                top: 16,
                p: 2.5,
              })}
            >
              {selected ? (
                <MeetingHistoryPreview
                  meeting={selected}
                  scope={scope}
                  onOpen={() => openRecap(selected.meetingId)}
                />
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  size="compact"
                  title={t('history.preview.emptyTitle')}
                  description={t('history.preview.emptyDescription')}
                />
              )}
            </Box>
          </Box>
          {query.data.total > query.data.pageSize && (
            <Stack alignItems="flex-end" sx={{ mt: 2 }}>
              <Pagination
                page={page + 1}
                count={meetingHistoryPageCount(query.data.total, query.data.pageSize)}
                onChange={(_, value) => setPage(value - 1)}
              />
            </Stack>
          )}
        </>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('history.empty')}
          description={t('history.emptyDescription')}
        />
      )}
    </PageCanvas>
  );
}

function MeetingHistoryRow({
  meeting,
  selected,
  onSelect,
  onOpen,
}: {
  meeting: VideoMeetingHistoryItem;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  return (
    <Stack
      component="article"
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      gap={1.5}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderLeft: 3,
        borderLeftColor: selected ? 'primary.main' : 'transparent',
        ...(selected
          ? {
              bgcolor: 'action.selected',
            }
          : {}),
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: { xs: 'none', sm: 'grid' },
          width: 40,
          height: 40,
          flex: '0 0 auto',
          placeItems: 'center',
          borderRadius: 2,
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09),
        }}
      >
        <FileClock size={19} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="h2" variant="subtitle2" fontWeight="fontWeightBold">
          {meeting.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('history.endedAt', {
            time: formatMeetingDateTime(meeting.endedAt, i18n.language),
          })}
        </Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
          <Chip
            size="small"
            icon={<Clock3 size={13} aria-hidden="true" />}
            label={t('history.duration', { count: meeting.actualDurationMinutes })}
          />
          <Chip
            size="small"
            icon={<UsersRound size={13} aria-hidden="true" />}
            label={t('history.peak', { count: meeting.participantPeak })}
          />
          {meeting.recordingAvailable && (
            <Chip size="small" variant="outlined" label={t('history.recording')} />
          )}
          {meeting.transcriptAvailable && (
            <Chip size="small" variant="outlined" label={t('history.transcript')} />
          )}
          {!meeting.recordingAvailable && !meeting.transcriptAvailable && (
            <Chip size="small" variant="outlined" label={t('history.contentUnavailable')} />
          )}
          {meeting.averageQualityScore != null && (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={t('history.quality', { value: meeting.averageQualityScore })}
            />
          )}
        </Stack>
      </Box>
      <Stack direction="row" gap={0.75} justifyContent={{ xs: 'flex-end', sm: 'initial' }}>
        <ActionButton
          intent="quiet"
          size="small"
          onClick={onSelect}
          aria-pressed={selected}
          sx={{ display: { xs: 'none', lg: 'inline-flex' }, minHeight: 44 }}
        >
          {t('history.preview.action')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} aria-hidden="true" />}
          onClick={onOpen}
          sx={{ minHeight: 44 }}
        >
          {t('history.openRecap')}
        </ActionButton>
      </Stack>
    </Stack>
  );
}

function MeetingHistoryPreview({
  meeting,
  scope,
  onOpen,
}: {
  meeting: VideoMeetingHistoryItem;
  scope: string;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const [now, setNow] = useState(Date.now);
  const reportQuery = useQuery({
    queryKey: ['meetings', 'history', 'preview', 'published-report', scope, meeting.meetingId],
    queryFn: () => getLatestPublishedVideoMeetingIntelligenceReport(meeting.meetingId),
    enabled: meeting.recordingAvailable || meeting.transcriptAvailable,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const report = reportQuery.data;
  const reportVisible = Boolean(
    report?.state === 'PUBLISHED' &&
    report.audience === 'MEETING_PARTICIPANTS' &&
    report.analysis &&
    (report.legalHold || Date.parse(report.retentionUntil) > now)
  );
  return (
    <Stack gap={2}>
      <Stack gap={0.75}>
        <Typography variant="caption" color="text.secondary">
          {t('history.preview.verifiedProjection')}
        </Typography>
        <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
          {meeting.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('history.endedAt', {
            time: formatMeetingDateTime(meeting.endedAt, i18n.language),
          })}
        </Typography>
      </Stack>
      <Divider />
      {reportVisible && report?.analysis ? (
        <Box data-testid="meeting-library-ai-preview">
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
            <Sparkles size={15} aria-hidden="true" />
            <Typography variant="subtitle2">{t('history.preview.aiSummary')}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {report.analysis.executiveSummary.text}
          </Typography>
        </Box>
      ) : null}
      {meeting.recordingAvailable ? (
        <Box
          data-testid="meeting-library-recording-preview"
          sx={{
            aspectRatio: '16 / 9',
            minHeight: 156,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'grey.900',
            color: 'common.white',
            borderRadius: foundationTokens.radius.control + 'px',
            textAlign: 'center',
            p: 2,
          }}
        >
          <Stack alignItems="center" gap={1}>
            <Radio size={24} aria-hidden="true" />
            <Typography variant="body2">{t('history.preview.recordingAvailable')}</Typography>
            <ActionButton
              intent="primary"
              size="small"
              startIcon={<Play size={15} aria-hidden="true" />}
              onClick={onOpen}
              sx={{ minHeight: 44 }}
            >
              {t('history.preview.openRecording')}
            </ActionButton>
          </Stack>
        </Box>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1.5,
        }}
      >
        <HistoryFact
          icon={FileClock}
          label={t('history.preview.duration')}
          value={t('history.duration', { count: meeting.actualDurationMinutes })}
        />
        <HistoryFact
          icon={UsersRound}
          label={t('history.preview.attendance')}
          value={t('history.peak', { count: meeting.participantPeak })}
        />
        <HistoryFact
          icon={Gauge}
          label={t('history.preview.quality')}
          value={
            meeting.averageQualityScore == null
              ? t('history.preview.notMeasured')
              : t('history.quality', { value: meeting.averageQualityScore })
          }
        />
        <HistoryFact
          icon={Radio}
          label={t('history.preview.evidence')}
          value={t('history.preview.evidenceCount', {
            count: Number(meeting.recordingAvailable) + Number(meeting.transcriptAvailable),
          })}
        />
      </Box>
      <Divider />
      <Typography variant="caption" color="text.secondary">
        {t('history.preview.openHint')}
      </Typography>
      <ActionButton
        intent="primary"
        endIcon={<ArrowRight size={16} aria-hidden="true" />}
        onClick={onOpen}
        sx={{ width: '100%', minHeight: 44 }}
      >
        {t('history.openRecap')}
      </ActionButton>
    </Stack>
  );
}

function HistoryFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileClock;
  label: string;
  value: string;
}) {
  return (
    <Stack gap={0.35} sx={{ minWidth: 0 }}>
      <Stack direction="row" gap={0.5} alignItems="center" color="text.secondary">
        <Icon size={14} aria-hidden="true" />
        <Typography variant="caption">{label}</Typography>
      </Stack>
      <Typography variant="body2" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}
