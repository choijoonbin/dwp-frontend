import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Clock3,
  FileClock,
  Gauge,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Video,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  UsersRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  foundationTokens,
  FormField,
  GuidedEmptyState,
  InlineFeedback,
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
import type { VideoMeetingRecordBookmark } from '@dwp-frontend/shared-utils/api/video-meeting-record-preferences-api';
import { useSearchParams } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { ProductSurfaceLocalNotFound } from '../../components/product-surface-local-not-found';
import { formatMeetingDateTime, MeetingPageHeading } from './meeting-components';
import { MeetingRecapDetail } from './meeting-recap-detail';
import { meetingRecapReference } from './meeting-recap-source';
import { meetingInsetSurface, meetingShape, meetingSurface } from './meeting-visual-system';
import { MeetingRecapPipeline } from './meeting-recap-pipeline';
import { useMeetingRecordBookmarks } from './use-meeting-record-bookmarks';
import {
  meetingHistoryNavigation,
  meetingHistoryNavigationAvailable,
  meetingHistoryHasViewerMembership,
  type MeetingHistoryNavigation,
} from './meeting-history-navigation';

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
  role: HistoryRoleFilter = 'ALL',
  options: {
    organizer?: string;
    periodDays?: number;
    now?: number;
    order?: 'NEWEST' | 'OLDEST';
    navigation?: MeetingHistoryNavigation;
  } = {}
): VideoMeetingHistoryItem[] {
  const query = search.trim().toLocaleLowerCase();
  const filtered = meetings.filter((meeting) => {
    if (options.navigation && !meetingHistoryNavigationAvailable(options.navigation)) return false;
    if (options.navigation === 'PARTICIPATING' && !meetingHistoryHasViewerMembership(meeting))
      return false;
    if (options.organizer && meeting.organizerName !== options.organizer) return false;
    if (
      options.periodDays &&
      (!meeting.endedAt ||
        !Number.isFinite(Date.parse(meeting.endedAt)) ||
        Date.parse(meeting.endedAt) < (options.now ?? Date.now()) - options.periodDays * 86_400_000)
    )
      return false;
    if (evidence === 'RECORDING' && !meeting.recordingAvailable) return false;
    if (evidence === 'TRANSCRIPT' && !meeting.transcriptAvailable) return false;
    if (evidence === 'NO_MEDIA' && (meeting.recordingAvailable || meeting.transcriptAvailable))
      return false;
    if (role === 'HOST' && !meeting.canHost) return false;
    if (role === 'ATTENDEE' && (meeting.canHost || !meetingHistoryHasViewerMembership(meeting)))
      return false;
    if (!query) return true;
    return [meeting.title, meeting.organizerName].some((value) =>
      value.toLocaleLowerCase().includes(query)
    );
  });
  return options.order
    ? filtered.sort(
        (left, right) =>
          (Date.parse(left.endedAt) - Date.parse(right.endedAt)) *
          (options.order === 'OLDEST' ? 1 : -1)
      )
    : filtered;
}

export function MeetingHistory() {
  const { t } = useTranslation('meetings');
  const compact = useMediaQuery('(max-width: 599px)');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [evidence, setEvidence] = useState<HistoryEvidenceFilter>('ALL');
  const [navigation, setNavigation] = useState<MeetingHistoryNavigation>('ALL');
  const [role, setRole] = useState<HistoryRoleFilter>('ALL');
  const [periodDays, setPeriodDays] = useState('ALL');
  const [organizer, setOrganizer] = useState('ALL');
  const [order, setOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
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
    queryKey: ['meetings', 'history', scope, navigation === 'FAVORITES', page],
    queryFn: ({ signal }) =>
      getVideoMeetingHistory(page, MEETING_HISTORY_PAGE_SIZE, {
        favoriteOnly: navigation === 'FAVORITES',
        signal,
      }),
    staleTime: 30_000,
    retry: false,
    gcTime: 0,
    enabled: isAuthenticated && Boolean(user) && selectedReference === null,
    meta: { accessSensitive: true },
  });
  const bookmarks = useMeetingRecordBookmarks(
    scope,
    query.data?.items.map(({ meetingId }) => meetingId) ?? [],
    isAuthenticated && Boolean(user) && selectedReference === null
  );
  useEffect(() => {
    if (!query.isSuccess || query.isFetching || !query.data) return;
    const lastPage = Math.max(0, Math.ceil(query.data.total / query.data.pageSize) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [page, query.data, query.isFetching, query.isSuccess]);
  const filtered = useMemo(
    () =>
      filterMeetingHistoryPage(query.data?.items ?? [], search, evidence, role, {
        organizer: organizer === 'ALL' ? undefined : organizer,
        periodDays: periodDays === 'ALL' ? undefined : Number(periodDays),
        order,
        navigation,
      }),
    [evidence, query.data?.items, role, search, organizer, periodDays, order, navigation]
  );
  const evidenceCounts = useMemo(() => {
    const meetings = query.data?.items ?? [];
    return {
      ALL: meetings.length,
      PARTICIPATING: meetings.filter(meetingHistoryHasViewerMembership).length,
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
            next.delete('candidateId');
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
        description={compact ? '' : t('history.description')}
        density="compact"
      />
      <Alert
        severity="info"
        icon={<FileClock size={18} />}
        sx={{ mb: 2, py: 0.25, borderRadius: meetingShape.inset }}
      >
        {t('history.recordingGovernance')}
      </Alert>

      {!bookmarks.accessDenied && !query.isError && (
        <Box
          component="section"
          aria-label={t('history.filters.label')}
          sx={(theme) => ({ ...meetingSurface(theme), mb: 2.5, p: { xs: 1.5, sm: 2 } })}
        >
          <Tabs
            value={navigation}
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label={t('designReview.library.navigationLabel')}
            onChange={(_, value: MeetingHistoryNavigation) => {
              if (meetingHistoryNavigationAvailable(value)) {
                setNavigation(value);
                setPage(0);
              }
            }}
            sx={{
              minHeight: 44,
              bgcolor: 'action.hover',
              borderRadius: meetingShape.inset,
              px: 0.5,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                minHeight: 40,
                my: 0.5,
                px: { xs: 1.5, sm: 2 },
                borderRadius: meetingShape.inset,
              },
              '& .MuiTab-root.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              },
            }}
          >
            {meetingHistoryNavigation.map((value) => (
              <Tab
                key={value}
                value={value}
                disabled={!meetingHistoryNavigationAvailable(value)}
                aria-describedby={
                  !meetingHistoryNavigationAvailable(value)
                    ? 'meeting-library-projection-note'
                    : undefined
                }
                label={`${t(`designReview.library.navigation.${value}`)}${query.data && !query.isError && navigation !== 'FAVORITES' && (value === 'ALL' || value === 'PARTICIPATING') ? ` ${evidenceCounts[value]}` : ''}`}
              />
            ))}
          </Tabs>
          <Typography
            id="meeting-library-projection-note"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1 }}
          >
            {t(
              navigation === 'FAVORITES'
                ? 'history.bookmarks.hint'
                : navigation === 'PARTICIPATING'
                  ? 'designReview.library.membershipHint'
                  : 'designReview.library.projectionUnavailable'
            )}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr) 44px',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(5, minmax(0, 1fr))',
              },
              gap: 1.5,
              py: 2,
            }}
          >
            <FormField
              size="small"
              sx={{ gridColumn: { xs: '1', sm: '1 / -1', lg: '1 / 5' } }}
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
            <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <ActionIconButton
                label={t('history.filters.label')}
                onClick={() => setShowFilters((value) => !value)}
                aria-expanded={showFilters}
              >
                <SlidersHorizontal size={18} aria-hidden="true" />
              </ActionIconButton>
            </Box>
            <ActionButton
              intent="secondary"
              startIcon={<RotateCcw size={16} aria-hidden="true" />}
              onClick={() => {
                setSearch('');
                setRole('ALL');
                setEvidence('ALL');
                setNavigation('ALL');
                setPage(0);
                setOrganizer('ALL');
                setPeriodDays('ALL');
                setOrder('NEWEST');
              }}
              sx={{
                minHeight: 40,
                display: { xs: showFilters ? 'flex' : 'none', sm: 'flex' },
                gridColumn: { xs: '1 / -1', sm: 'auto' },
              }}
            >
              {t('designReview.library.reset')}
            </ActionButton>
            <SelectField
              sx={{
                display: { xs: showFilters ? 'block' : 'none', sm: 'block' },
                gridColumn: { xs: '1 / -1', sm: 'auto' },
              }}
              size="small"
              label={t('designReview.library.period')}
              value={periodDays}
              onValueChange={(value) => setPeriodDays(value ?? 'ALL')}
              options={['ALL', '7', '30', '90'].map((value) => ({
                value,
                label:
                  value === 'ALL'
                    ? t('designReview.library.allPeriods')
                    : t('designReview.library.recentDays', { count: Number(value) }),
              }))}
            />
            <SelectField
              sx={{
                display: { xs: showFilters ? 'block' : 'none', sm: 'block' },
                gridColumn: { xs: '1 / -1', sm: 'auto' },
              }}
              size="small"
              label={t('designReview.library.organizer')}
              value={organizer}
              onValueChange={(value) => setOrganizer(value ?? 'ALL')}
              options={[
                { value: 'ALL', label: t('designReview.library.allOrganizers') },
                ...Array.from(
                  new Set(
                    (query.data?.items ?? [])
                      .map((meeting) => meeting.organizerName)
                      .filter((name) => name?.trim())
                  )
                ).map((name) => ({ value: name, label: name })),
              ]}
            />
            <SelectField
              sx={{
                display: { xs: showFilters ? 'block' : 'none', sm: 'block' },
                gridColumn: { xs: '1 / -1', sm: 'auto' },
              }}
              size="small"
              label={t('history.filters.evidenceLabel')}
              value={evidence}
              onValueChange={(value) => setEvidence(value as HistoryEvidenceFilter)}
              options={(['ALL', 'RECORDING', 'TRANSCRIPT', 'NO_MEDIA'] as const).map((value) => ({
                value,
                label: t(`history.filters.evidence.${value}`),
              }))}
            />
            {(['publication', 'retention'] as const).map((axis) => (
              <SelectField
                key={axis}
                sx={{
                  display: { xs: showFilters ? 'block' : 'none', sm: 'block' },
                  gridColumn: { xs: '1 / -1', sm: 'auto' },
                }}
                size="small"
                disabled
                onValueChange={() => {
                  /* Requires an authoritative server projection. */
                }}
                label={t(`designReview.library.${axis}Label`)}
                value="UNAVAILABLE"
                options={[
                  { value: 'UNAVAILABLE', label: t('designReview.library.projectionPending') },
                ]}
              />
            ))}
            <SelectField
              sx={{
                display: { xs: showFilters ? 'block' : 'none', sm: 'block' },
                gridColumn: { xs: '1 / -1', sm: 'auto' },
              }}
              size="small"
              label={t('history.filters.roleLabel')}
              value={role}
              onValueChange={(value) => setRole(value as HistoryRoleFilter)}
              options={(['ALL', 'HOST', 'ATTENDEE'] as const).map((value) => ({
                value,
                label: t(`history.filters.role.${value}`),
              }))}
            />
            <SelectField
              sx={{
                display: { xs: showFilters ? 'block' : 'none', sm: 'block' },
                gridColumn: { xs: '1 / -1', sm: 'auto' },
              }}
              size="small"
              label={t('designReview.library.order')}
              value={order}
              onValueChange={(value) => setOrder(value === 'OLDEST' ? 'OLDEST' : 'NEWEST')}
              options={(['NEWEST', 'OLDEST'] as const).map((value) => ({
                value,
                label: t(`designReview.library.${value}`),
              }))}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                gridColumn: '1 / -1',
                maxWidth: 520,
                display: { xs: showFilters ? 'block' : 'none', sm: 'block' },
              }}
            >
              {t('history.filters.pageScope')}
            </Typography>
          </Box>
        </Box>
      )}
      {bookmarks.failed && !bookmarks.accessDenied && (
        <InlineFeedback severity="warning" sx={{ mb: 2 }}>
          {t('history.bookmarks.unavailable')}
          <ActionButton intent="quiet" size="small" onClick={() => void bookmarks.refresh()}>
            {t('actions.retry')}
          </ActionButton>
        </InlineFeedback>
      )}
      {!isAuthenticated || query.isLoading ? (
        <LoadingState label={t('history.loading')} variant="skeleton" skeletonRows={6} />
      ) : query.isError || !query.data || bookmarks.accessDenied ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void bookmarks.refresh()}
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
            <Box
              data-testid="meeting-library-list"
              sx={{ display: 'grid', gap: 1.25, minWidth: 0 }}
            >
              {filtered.length ? (
                filtered.map((meeting) => (
                  <MeetingHistoryRow
                    key={meeting.meetingId}
                    meeting={meeting}
                    selected={selected?.meetingId === meeting.meetingId}
                    onSelect={() => setSelectedId(meeting.meetingId)}
                    onOpen={() => openRecap(meeting.meetingId)}
                    bookmark={bookmarks.items.find((item) => item.meetingId === meeting.meetingId)}
                    bookmarkBusy={bookmarks.busy}
                    onBookmark={(bookmark) => void bookmarks.toggle(bookmark)}
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
  bookmark,
  bookmarkBusy,
  onBookmark,
}: {
  meeting: VideoMeetingHistoryItem;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  bookmark?: VideoMeetingRecordBookmark;
  bookmarkBusy: boolean;
  onBookmark: (bookmark: VideoMeetingRecordBookmark) => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  return (
    <Box
      component="article"
      sx={(theme) => ({
        ...meetingSurface(theme, { interactive: true }),
        p: { xs: 2, sm: 2 },
        border: selected ? `2px solid ${theme.palette.primary.main}` : undefined,
        borderLeftWidth: { xs: 4, lg: selected ? 4 : 1 },
        borderLeftColor: selected ? 'primary.main' : 'divider',
        minWidth: 0,
      })}
    >
      <Box
        data-testid="meeting-library-row-header"
        sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 0.75, mb: 1 }}
      >
        <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" sx={{ minWidth: 0 }}>
          <Chip
            size="small"
            label={t(
              meeting.canHost
                ? 'history.filters.role.HOST'
                : meetingHistoryHasViewerMembership(meeting)
                  ? 'history.filters.role.ATTENDEE'
                  : 'followUps.notSet'
            )}
          />
          <Chip
            size="small"
            color={meeting.transcriptAvailable ? 'success' : 'default'}
            variant="outlined"
            label={t(
              meeting.transcriptAvailable
                ? 'history.transcript'
                : 'history.recap.artifacts.states.NONE'
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
            {formatMeetingDateTime(meeting.endedAt, i18n.language)}
          </Typography>
        </Stack>
        <ActionIconButton
          label={t(bookmark?.favorite ? 'history.bookmarks.remove' : 'history.bookmarks.add', {
            title: meeting.title,
          })}
          disabled={!bookmark || bookmarkBusy}
          aria-pressed={bookmark?.favorite ?? false}
          onClick={() => bookmark && onBookmark(bookmark)}
          sx={{
            color: bookmark?.favorite ? 'warning.dark' : 'text.secondary',
            alignSelf: 'start',
            minWidth: 44,
            minHeight: 44,
          }}
        >
          <Star size={18} fill={bookmark?.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </ActionIconButton>
      </Box>
      <Typography
        component="h2"
        variant="h6"
        fontWeight="fontWeightBold"
        sx={{ lineHeight: 'h6.lineHeight', mb: 1, overflowWrap: 'anywhere' }}
      >
        {meeting.title}
      </Typography>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Avatar
          sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 'caption.fontSize' }}
        >
          {meeting.organizerName?.slice(0, 1)}
        </Avatar>
        <Typography variant="body2" color="text.secondary">
          {meeting.organizerName ||
            `${t('designReview.library.organizer')} · ${t('followUps.notSet')}`}
        </Typography>
        {meeting.averageQualityScore != null && (
          <Typography variant="caption" color="success.dark" sx={{ ml: 'auto' }}>
            {t('history.quality', { value: meeting.averageQualityScore })}
          </Typography>
        )}
      </Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
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
          <Chip
            size="small"
            icon={<Video size={13} aria-hidden="true" />}
            label={t('history.recording')}
          />
        )}
        {!meeting.recordingAvailable && !meeting.transcriptAvailable && (
          <Chip size="small" variant="outlined" label={t('history.contentUnavailable')} />
        )}
      </Stack>
      <Stack
        direction="row"
        gap={0.75}
        justifyContent="flex-end"
        sx={{ mt: 1.5, pt: 1, borderTop: 1, borderColor: 'divider' }}
      >
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
          sx={{ minHeight: 44, color: 'primary.main' }}
        >
          {t('history.openRecap')}
        </ActionButton>
      </Stack>
    </Box>
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
    enabled: true,
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
    !reportQuery.isError &&
    !reportQuery.isRefetchError &&
    report?.meetingId === meeting.meetingId &&
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
      <MeetingRecapPipeline
        compact
        recording={meeting.recordingAvailable}
        transcript={meeting.transcriptAvailable}
        analysis={reportVisible}
        approved={reportVisible && Boolean(report?.approvedAt)}
        published={reportVisible}
      />
      {reportVisible && report?.analysis ? (
        <Box
          data-testid="meeting-library-ai-preview"
          sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 2 })}
        >
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
            <Sparkles size={15} aria-hidden="true" />
            <Typography variant="subtitle2">{t('history.preview.aiSummary')}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {report.analysis.executiveSummary.text}
          </Typography>
        </Box>
      ) : (
        <Box sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 2 })}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('history.preview.aiSummary')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              reportQuery.isError
                ? 'history.recap.intelligence.loadErrorDescription'
                : 'history.recap.ai.unavailableTitle'
            )}
          </Typography>
        </Box>
      )}
      {
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
            <Typography variant="body2">
              {t(
                meeting.recordingAvailable
                  ? 'history.preview.recordingAvailable'
                  : 'history.recap.evidenceRail.recordingUnavailable'
              )}
            </Typography>
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
      }
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
      <Stack
        direction="row"
        gap={1}
        sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 1.5 })}
      >
        <ShieldCheck size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary">
          {t('history.preview.openHint')}
        </Typography>
      </Stack>
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
