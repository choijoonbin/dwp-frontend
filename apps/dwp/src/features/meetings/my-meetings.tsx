import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DoorOpen,
  Hash,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ActionButton,
  ErrorState,
  FormField,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getVideoMeetings,
  type VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  formatMeetingDateTime,
  formatMeetingTime,
  MeetingPageHeading,
  MeetingStatusChip,
} from './meeting-components';
import { meetingPreparationPath } from './meeting-context-routing';
import { homeAgendaItems } from './meeting-home-model';
import { meetingListSurface, meetingSurface } from './meeting-visual-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { MeetingScheduleManagement } from './meeting-schedule-management';

type MeetingTimeFilter = 'UPCOMING' | 'LIVE' | 'PAST' | 'ALL';
type MeetingRoleFilter = 'ALL' | 'HOST' | 'ATTENDEE';
export const MY_MEETINGS_PAGE_SIZE = 10;

export function meetingPagination(total: number, page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  const boundedPage = Math.min(Math.max(0, page), totalPages - 1);
  return {
    page: boundedPage,
    current: boundedPage + 1,
    total: totalPages,
    hasPrevious: boundedPage > 0,
    hasNext: boundedPage + 1 < totalPages,
  } as const;
}

function meetingTimeBucket(meeting: VideoMeetingSummary): Exclude<MeetingTimeFilter, 'ALL'> {
  if (meeting.lifecycleState === 'LIVE') return 'LIVE';
  if (meeting.lifecycleState === 'ENDED' || meeting.lifecycleState === 'CANCELLED') return 'PAST';
  return 'UPCOMING';
}

export function filterMeetingPage(
  meetings: VideoMeetingSummary[],
  search: string,
  time: MeetingTimeFilter,
  role: MeetingRoleFilter
): VideoMeetingSummary[] {
  const query = search.trim().toLocaleLowerCase();
  return meetings.filter((meeting) => {
    if (time !== 'ALL' && meetingTimeBucket(meeting) !== time) return false;
    if (role === 'HOST' && !meeting.canHost) return false;
    if (role === 'ATTENDEE' && meeting.canHost) return false;
    if (!query) return true;
    return [meeting.title, meeting.organizerName, meeting.agenda ?? ''].some((value) =>
      value.toLocaleLowerCase().includes(query)
    );
  });
}

function meetingDestination(meeting: VideoMeetingSummary): string | null {
  if (meeting.lifecycleState === 'CANCELLED') return null;
  if (meeting.lifecycleState === 'ENDED')
    return `/meetings/history?meeting=${encodeURIComponent(meeting.meetingId)}`;
  if (meeting.lifecycleState === 'SCHEDULED' || meeting.lifecycleState === 'DRAFT')
    return meetingPreparationPath(meeting.meetingId);
  return `/meetings/room/${encodeURIComponent(meeting.meetingId)}`;
}

export function MyMeetings() {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  const [page, setPage] = useState(0);
  const [timeFilter, setTimeFilter] = useState<MeetingTimeFilter>('UPCOMING');
  const [roleFilter, setRoleFilter] = useState<MeetingRoleFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['meetings', 'mine', scope, page, MY_MEETINGS_PAGE_SIZE],
    queryFn: () => getVideoMeetings(page, MY_MEETINGS_PAGE_SIZE),
    enabled: isAuthenticated && Boolean(user),
    staleTime: 30_000,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const filtered = useMemo(
    () => filterMeetingPage(query.data?.items ?? [], search, timeFilter, roleFilter),
    [query.data?.items, roleFilter, search, timeFilter]
  );
  const selected = filtered.find((meeting) => meeting.meetingId === selectedId) ?? filtered[0];
  const selectedAgenda = homeAgendaItems(selected?.agenda);
  const pagination = query.data
    ? meetingPagination(query.data.total, query.data.page, query.data.pageSize)
    : null;
  const canonicalPage = pagination?.page;
  useEffect(() => {
    if (canonicalPage !== undefined && canonicalPage !== page) setPage(canonicalPage);
  }, [canonicalPage, page]);
  const timeCounts = useMemo(
    () => ({
      UPCOMING: (query.data?.items ?? []).filter(
        (meeting) => meetingTimeBucket(meeting) === 'UPCOMING'
      ).length,
      LIVE: (query.data?.items ?? []).filter((meeting) => meetingTimeBucket(meeting) === 'LIVE')
        .length,
      PAST: (query.data?.items ?? []).filter((meeting) => meetingTimeBucket(meeting) === 'PAST')
        .length,
      ALL: query.data?.items.length ?? 0,
    }),
    [query.data?.items]
  );

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <MeetingPageHeading
        eyebrow={t('mine.eyebrow')}
        title={t('mine.title')}
        description={t('mine.description')}
        density="compact"
        actions={
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <ActionButton
              intent="quiet"
              startIcon={<Hash size={17} aria-hidden="true" />}
              onClick={() => navigate('/meetings/join')}
            >
              {t('home.join.action')}
            </ActionButton>
            <ActionButton
              intent="secondary"
              startIcon={<DoorOpen size={17} aria-hidden="true" />}
              onClick={() => navigate('/meetings/mine?view=personal-room')}
            >
              {t('personalRoom.title')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Plus size={17} />}
              onClick={() => navigate('/meetings/mine?view=schedule')}
            >
              {t('home.schedule.action')}
            </ActionButton>
          </Stack>
        }
      />

      <Box
        component="section"
        aria-label={t('mine.filters.label')}
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tabs
          value={timeFilter}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t('mine.filters.timeLabel')}
          onChange={(_, value: MeetingTimeFilter) => setTimeFilter(value)}
          sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, px: { xs: 1.5, sm: 2 } } }}
        >
          {(['UPCOMING', 'LIVE', 'PAST', 'ALL'] as const).map((value) => (
            <Tab
              key={value}
              value={value}
              label={`${t(`mine.filters.time.${value}`)} ${timeCounts[value]}`}
            />
          ))}
        </Tabs>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(180px, .42fr)' },
            gap: 1.5,
            py: 2,
          }}
        >
          <FormField
            size="small"
            label={t('mine.filters.search')}
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
            label={t('mine.filters.roleLabel')}
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as MeetingRoleFilter)}
            options={(['ALL', 'HOST', 'ATTENDEE'] as const).map((value) => ({
              value,
              label: t(`mine.filters.role.${value}`),
            }))}
          />
        </Box>
      </Box>

      {!isAuthenticated || query.isLoading ? (
        <LoadingState label={t('mine.loading')} variant="skeleton" skeletonRows={6} />
      ) : query.isError || !query.data ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <Stack direction="row" justifyContent="space-between" gap={2} sx={{ mb: 1.5 }}>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {t('mine.filters.resultCount', { count: filtered.length })}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
              {t('mine.filters.pageScope')}
            </Typography>
          </Stack>
          <Box
            data-testid="my-meetings-workspace"
            sx={{
              display: 'grid',
              gridTemplateAreas: { xs: '"inspector" "list"', lg: '"list inspector"' },
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 2fr) minmax(280px, 1fr)',
              },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Box
              data-testid="my-meetings-list"
              sx={(theme) => ({ ...meetingListSurface(theme), gridArea: 'list' })}
            >
              {filtered.length ? (
                filtered.map((meeting) => {
                  const isSelected = selected?.meetingId === meeting.meetingId;
                  const agenda = homeAgendaItems(meeting.agenda);
                  return (
                    <ActionButton
                      key={meeting.meetingId}
                      intent="quiet"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(meeting.meetingId)}
                      sx={{
                        display:
                          isSelected && filtered.length > 1 ? { xs: 'none', lg: 'flex' } : 'flex',
                        width: '100%',
                        minHeight: isSelected ? 228 : 112,
                        px: { xs: 1.5, sm: 2 },
                        py: isSelected ? 2 : 1.5,
                        borderRadius: 0,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                        borderInlineStart: isSelected ? 4 : 3,
                        borderInlineStartColor: isSelected ? 'primary.main' : 'transparent',
                        ...(isSelected
                          ? {
                              bgcolor: 'action.selected',
                            }
                          : {}),
                      }}
                    >
                      <Stack direction="row" gap={1.25} sx={{ width: '100%', minWidth: 0 }}>
                        <Box sx={{ minWidth: 72 }}>
                          <Typography
                            variant={isSelected ? 'subtitle2' : 'body2'}
                            fontWeight="fontWeightBold"
                            color={isSelected ? 'primary.main' : 'text.primary'}
                          >
                            {formatMeetingTime(meeting.startsAt, i18n.language)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('units.minutes', { count: meeting.durationMinutes })}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                            <Typography
                              component="h2"
                              variant={isSelected ? 'h6' : 'subtitle2'}
                              fontWeight="fontWeightBold"
                            >
                              {meeting.title}
                            </Typography>
                            <MeetingStatusChip state={meeting.lifecycleState} />
                          </Stack>
                          {!isSelected && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mt: 0.5,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {meeting.agenda || t('room.agendaEmpty')}
                            </Typography>
                          )}
                          <Stack
                            direction="row"
                            gap={1}
                            alignItems="center"
                            flexWrap="wrap"
                            sx={{ mt: 0.75 }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {meeting.organizerName}
                            </Typography>
                            <Stack direction="row" gap={0.5} alignItems="center">
                              <UsersRound size={13} aria-hidden="true" />
                              <Typography variant="caption" color="text.secondary">
                                {t('units.participants', { count: meeting.attendeeCount })}
                              </Typography>
                            </Stack>
                            <Stack direction="row" gap={0.5} alignItems="center">
                              <ShieldCheck size={13} aria-hidden="true" />
                              <Typography variant="caption" color="text.secondary">
                                {t(`access.${meeting.accessScope}`)}
                              </Typography>
                            </Stack>
                          </Stack>
                          {isSelected && (
                            <Box
                              component="ol"
                              aria-label={t('mine.inspector.agenda')}
                              sx={{
                                display: { xs: 'none', lg: 'grid' },
                                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                gap: 1,
                                p: 0,
                                mt: 1.5,
                                mb: 0,
                                listStyle: 'none',
                              }}
                            >
                              {(agenda.length ? agenda : [t('room.agendaEmpty')]).map(
                                (item, index) => (
                                  <Box
                                    component="li"
                                    key={`${index}-${item}`}
                                    sx={{
                                      minWidth: 0,
                                      p: 1,
                                      border: 1,
                                      borderColor: 'divider',
                                      bgcolor: 'background.paper',
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="primary.main"
                                      fontWeight="fontWeightBold"
                                    >
                                      {String(index + 1).padStart(2, '0')}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                                    >
                                      {item}
                                    </Typography>
                                  </Box>
                                )
                              )}
                            </Box>
                          )}
                        </Box>
                      </Stack>
                    </ActionButton>
                  );
                })
              ) : query.data.items.length ? (
                <GuidedEmptyState
                  kind="no-results"
                  size="compact"
                  title={t('mine.filters.noMatches')}
                  description={t('mine.filters.noMatchesDescription')}
                />
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  title={t('mine.empty')}
                  description={t('mine.emptyDescription')}
                />
              )}
            </Box>
            <Box
              component="aside"
              aria-label={t('mine.inspector.label')}
              data-testid="my-meetings-inspector"
              sx={(theme) => ({
                ...meetingSurface(theme, { elevated: false }),
                gridArea: 'inspector',
                p: { xs: 2, sm: 2.5 },
                borderWidth: { xs: 2, lg: 1 },
                borderColor: { xs: 'primary.main', lg: 'divider' },
                position: { lg: 'sticky' },
                top: { lg: 16 },
              })}
            >
              {selected ? (
                <Stack gap={2}>
                  <Stack gap={0.75}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <MeetingStatusChip state={selected.lifecycleState} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={
                          selected.canHost
                            ? t('mine.filters.role.HOST')
                            : t('mine.filters.role.ATTENDEE')
                        }
                      />
                    </Stack>
                    <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                      {selected.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatMeetingDateTime(selected.startsAt, i18n.language)}
                    </Typography>
                  </Stack>
                  <Divider />
                  <Stack gap={1.25}>
                    <MeetingInspectorFact
                      icon={Clock3}
                      label={t('mine.inspector.duration')}
                      value={t('units.minutes', { count: selected.durationMinutes })}
                    />
                    <MeetingInspectorFact
                      icon={UsersRound}
                      label={t('mine.inspector.organizer')}
                      value={selected.organizerName}
                    />
                    <MeetingInspectorFact
                      icon={UsersRound}
                      label={t('mine.inspector.attendees')}
                      value={t('units.participants', { count: selected.attendeeCount })}
                    />
                    <MeetingInspectorFact
                      icon={ShieldCheck}
                      label={t('mine.inspector.access')}
                      value={t(`access.${selected.accessScope}`)}
                    />
                    <MeetingInspectorFact
                      icon={CalendarClock}
                      label={t('mine.inspector.code')}
                      value={selected.meetingCode}
                    />
                  </Stack>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('mine.inspector.agenda')}
                    </Typography>
                    {selectedAgenda.length ? (
                      <Stack
                        component="ol"
                        gap={0.75}
                        sx={{ p: 0, mt: 1, mb: 0, listStyle: 'none' }}
                      >
                        {selectedAgenda.map((item, index) => (
                          <Box
                            component="li"
                            key={`${index}-${item}`}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'auto minmax(0, 1fr)',
                              gap: 1,
                              alignItems: 'start',
                              p: 1,
                              bgcolor: 'action.hover',
                            }}
                          >
                            <Chip
                              size="small"
                              label={String(index + 1).padStart(2, '0')}
                              sx={{ minWidth: 36 }}
                            />
                            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                              {item}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" sx={{ mt: 0.5 }} color="text.secondary">
                        {t('room.agendaEmpty')}
                      </Typography>
                    )}
                  </Box>
                  <MeetingScheduleManagement meeting={selected} onChanged={() => query.refetch()} />
                  {meetingDestination(selected) && (
                    <ActionButton
                      intent="primary"
                      endIcon={<ArrowRight size={16} aria-hidden="true" />}
                      onClick={() => navigate(meetingDestination(selected)!)}
                      sx={{ width: '100%', minHeight: 44 }}
                    >
                      {selected.lifecycleState === 'ENDED'
                        ? t('history.openRecap')
                        : selected.lifecycleState === 'LIVE'
                          ? t('actions.join')
                          : t('home.focus.prepare')}
                    </ActionButton>
                  )}
                </Stack>
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  size="compact"
                  title={t('mine.inspector.emptyTitle')}
                  description={t('mine.inspector.emptyDescription')}
                />
              )}
            </Box>
          </Box>
          {pagination && pagination.total > 1 && (
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
              gap={1}
              sx={{ mt: 2 }}
            >
              <ActionButton
                intent="quiet"
                aria-label={t('mine.previous')}
                disabled={!pagination.hasPrevious}
                onClick={() => setPage(Math.max(0, pagination.page - 1))}
              >
                <ChevronLeft size={17} />
              </ActionButton>
              <Typography
                data-testid="my-meetings-page-status"
                variant="caption"
                color="text.secondary"
              >
                {t('mine.page', {
                  current: pagination.current,
                  total: pagination.total,
                })}
              </Typography>
              <ActionButton
                intent="quiet"
                aria-label={t('mine.next')}
                disabled={!pagination.hasNext}
                onClick={() => setPage(pagination.page + 1)}
              >
                <ChevronRight size={17} />
              </ActionButton>
            </Stack>
          )}
        </>
      )}
    </PageCanvas>
  );
}

function MeetingInspectorFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <Stack direction="row" gap={1} alignItems="flex-start">
      <Icon size={16} aria-hidden="true" style={{ marginTop: 2, flex: '0 0 auto' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
