import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Hash,
  Mail,
  Plus,
  Search,
  Timer,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionButton,
  ActionIconButton,
  ContentDialog,
  DatePickerField,
  ErrorState,
  FormField,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SelectField,
  useDateTimePolicy,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { getVideoMeetings } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { MeetingPageHeading } from './meeting-components';
import { meetingListContextPath } from './meeting-context-routing';
import { meetingInsetSurface, meetingShape, meetingSoftShadow } from './meeting-visual-system';
import {
  filterMeetingPage,
  meetingDateKey,
  meetingPagination,
  meetingTimeBucket,
  MY_MEETINGS_PAGE_SIZE,
  pendingMeetingInvitation,
  validMeetingDate,
  type MeetingRoleFilter,
  type MeetingSeriesFilter,
  type MeetingTimeFilter,
} from './my-meetings-model';
import { MyMeetingResponseActions, useMyMeetingsEvidence } from './my-meetings-evidence';
import { MyMeetingCard } from './my-meetings-presentation';
import { MyMeetingsInspector } from './my-meetings-inspector';

export { filterMeetingPage, meetingPagination, MY_MEETINGS_PAGE_SIZE } from './my-meetings-model';

export function MyMeetings() {
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  return (
    <MyMeetingsContent key={scope} scope={scope} authenticated={isAuthenticated && Boolean(user)} />
  );
}

function MyMeetingsContent({ scope, authenticated }: { scope: string; authenticated: boolean }) {
  const { t, i18n } = useTranslation('meetings');
  const { timeZone } = useDateTimePolicy();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Math.floor(Math.max(0, Math.min(10000, Number(params.get('page')) || 0)));
  const search = params.get('q') ?? '';
  const [compact, setCompact] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const wide = useMediaQuery(useTheme().breakpoints.up('lg'));
  const time = params.get('time') ?? 'UPCOMING';
  const timeFilter: MeetingTimeFilter = ['UPCOMING', 'LIVE', 'PAST', 'ALL', 'PENDING'].includes(
    time
  )
    ? (time as MeetingTimeFilter)
    : 'UPCOMING';
  const role = params.get('role') ?? 'ALL';
  const roleFilter: MeetingRoleFilter = ['ALL', 'HOST', 'ATTENDEE'].includes(role)
    ? (role as MeetingRoleFilter)
    : 'ALL';
  const series = params.get('series') ?? 'ALL';
  const seriesFilter: MeetingSeriesFilter = ['ALL', 'RECURRING', 'ONCE'].includes(series)
    ? (series as MeetingSeriesFilter)
    : 'ALL';
  const date = validMeetingDate(params.get('date'));
  const updateFilter = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  const query = useQuery({
    queryKey: ['meetings', 'mine', scope, page, MY_MEETINGS_PAGE_SIZE],
    queryFn: () => getVideoMeetings(page, MY_MEETINGS_PAGE_SIZE),
    enabled: authenticated,
    staleTime: 30_000,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const items = authenticated && !query.isError ? (query.data?.items ?? []) : [];
  const { evidence, refresh } = useMyMeetingsEvidence(items, scope);
  const filtered = filterMeetingPage(
    items,
    search,
    timeFilter,
    roleFilter,
    evidence,
    date,
    seriesFilter,
    timeZone
  );
  const selected =
    filtered.find((meeting) => meeting.meetingId === params.get('meeting')) ?? filtered[0];
  const pagination = query.data
    ? meetingPagination(query.data.total, query.data.page, query.data.pageSize)
    : null;
  const canonicalPage = pagination?.page;
  useEffect(() => {
    if (canonicalPage === undefined || canonicalPage === page) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (canonicalPage) next.set('page', String(canonicalPage));
        else next.delete('page');
        return next;
      },
      { replace: true }
    );
  }, [canonicalPage, page, setParams]);
  const timeCounts = {
    UPCOMING: items.filter((meeting) => meetingTimeBucket(meeting) === 'UPCOMING').length,
    LIVE: items.filter((meeting) => meetingTimeBucket(meeting) === 'LIVE').length,
    PAST: items.filter((meeting) => meetingTimeBucket(meeting) === 'PAST').length,
    PENDING: items.filter((meeting) =>
      pendingMeetingInvitation(evidence[meeting.meetingId]?.preparation)
    ).length,
    ALL: items.length,
  };
  const pending = items.filter((meeting) =>
    pendingMeetingInvitation(evidence[meeting.meetingId]?.preparation)
  );
  const groups = [
    ...new Set(filtered.map((meeting) => meetingDateKey(meeting.startsAt, timeZone))),
  ];
  const onChanged = async () => Promise.all([query.refetch({ throwOnError: true }), refresh()]);
  const evidencePartial = Object.values(evidence).some(({ failed }) => failed);
  const dateStep = (direction: number) => {
    const anchor = date || meetingDateKey(new Date().toISOString(), timeZone);
    const next = new Date(anchor + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + direction);
    updateFilter('date', next.toISOString().slice(0, 10));
  };
  return (
    <Box
      sx={{
        '@media (forced-colors: active)': {
          '&& button': {
            color: 'ButtonText',
            WebkitTextFillColor: 'ButtonText',
            backgroundColor: 'ButtonFace',
            borderColor: 'ButtonText',
          },
          '&& button:disabled': { color: 'GrayText', WebkitTextFillColor: 'GrayText' },
          '& .MuiTypography-root, & .MuiFormLabel-root, & .MuiInputBase-input, & .MuiChip-label': {
            color: 'CanvasText',
            WebkitTextFillColor: 'CanvasText',
          },
        },
      }}
    >
      <PageCanvas mode="workspace" topInset="compact">
        {!wide ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1.5}
            sx={{ mb: 2.5 }}
          >
            <Typography component="h1" variant="h5" fontWeight="fontWeightBold">
              {t('mine.title')}
            </Typography>
            <ActionButton
              intent="primary"
              startIcon={<Plus size={17} aria-hidden="true" />}
              onClick={() => navigate(meetingListContextPath('schedule', params.toString()))}
            >
              {t('home.schedule.action')}
            </ActionButton>
          </Stack>
        ) : (
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
                  sx={{ display: { xs: 'none', lg: 'inline-flex' } }}
                >
                  {t('home.join.action')}
                </ActionButton>
                <ActionButton
                  intent="secondary"
                  startIcon={<DoorOpen size={17} aria-hidden="true" />}
                  onClick={() =>
                    navigate(meetingListContextPath('personal-room', params.toString()))
                  }
                  sx={{ display: { xs: 'none', lg: 'inline-flex' } }}
                >
                  {t('personalRoom.title')}
                </ActionButton>
                <ActionButton
                  intent="primary"
                  startIcon={<Plus size={17} aria-hidden="true" />}
                  onClick={() => navigate(meetingListContextPath('schedule', params.toString()))}
                >
                  {t('home.schedule.action')}
                </ActionButton>
              </Stack>
            }
          />
        )}
        <Box
          component="section"
          aria-label={t('mine.filters.label')}
          sx={(theme) => ({
            mb: 3,
            p: { xs: 0, md: 1.5 },
            bgcolor: { xs: 'transparent', md: 'background.paper' },
            borderRadius: meetingShape.stage,
            boxShadow: { xs: 'none', md: meetingSoftShadow(theme) },
          })}
        >
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={(theme) => ({ ...meetingInsetSurface(theme), p: 0.5 })}
          >
            <Tabs
              value={timeFilter}
              variant="scrollable"
              allowScrollButtonsMobile
              aria-label={t('mine.filters.timeLabel')}
              onChange={(_, value: MeetingTimeFilter) => updateFilter('time', value)}
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTab-root': {
                  minHeight: 44,
                  minWidth: { xs: 70, md: 112 },
                  px: 1.25,
                  borderRadius: meetingShape.control,
                  '&.Mui-selected': { bgcolor: 'background.paper', fontWeight: 'fontWeightBold' },
                },
              }}
            >
              {(['UPCOMING', 'LIVE', 'PAST', 'PENDING'] as const).map((value) => (
                <Tab
                  key={value}
                  value={value}
                  label={
                    t(
                      value === 'PENDING' ? 'mine.design.pendingTab' : 'mine.filters.time.' + value
                    ) +
                    ' ' +
                    timeCounts[value]
                  }
                />
              ))}
              {timeFilter === 'ALL' && (
                <Tab value="ALL" label={t('mine.filters.time.ALL') + ' ' + timeCounts.ALL} />
              )}
            </Tabs>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1.5, display: { xs: 'none', lg: 'block' } }}
            >
              {timeZone}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr)',
              },
              gap: 1.5,
              pt: 2,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              sx={(theme) => ({ ...meetingInsetSurface(theme), px: 0.5 })}
            >
              <ActionIconButton label={t('mine.design.previousDate')} onClick={() => dateStep(-1)}>
                <ChevronLeft size={16} />
              </ActionIconButton>
              {wide ? (
                <DatePickerField
                  size="small"
                  label={t('mine.design.date')}
                  value={date || null}
                  onValueChange={(value) => updateFilter('date', value ?? '')}
                  sx={{ minWidth: 0, flex: 1 }}
                />
              ) : (
                <ActionButton
                  intent="quiet"
                  aria-haspopup="dialog"
                  aria-label={t('mine.design.date')}
                  onClick={() => setDatePickerOpen(true)}
                  startIcon={<CalendarDays size={16} aria-hidden="true" />}
                  sx={{ flex: 1, minWidth: 0, whiteSpace: 'normal', px: 0.5 }}
                >
                  {date
                    ? formatDate(
                        date + 'T12:00:00Z',
                        { dateStyle: 'medium', timeZone: 'UTC' },
                        resolveSupportedLocale(i18n.language)
                      )
                    : t('mine.filters.time.ALL')}
                </ActionButton>
              )}
              <ActionIconButton label={t('mine.design.nextDate')} onClick={() => dateStep(1)}>
                <ChevronRight size={16} />
              </ActionIconButton>
            </Stack>
            <SelectField
              sx={{ display: { xs: 'none', md: 'block' } }}
              size="small"
              label={t('mine.filters.roleLabel')}
              value={roleFilter}
              onValueChange={(value) => updateFilter('role', value)}
              options={(['ALL', 'HOST', 'ATTENDEE'] as const).map((value) => ({
                value,
                label: t('mine.filters.role.' + value),
              }))}
            />
            <SelectField
              sx={{ display: { xs: advancedFilters ? 'block' : 'none', md: 'block' } }}
              size="small"
              label={t('mine.design.seriesFilter')}
              value={seriesFilter}
              onValueChange={(value) => updateFilter('series', value)}
              options={(['ALL', 'RECURRING', 'ONCE'] as const).map((value) => ({
                value,
                label: t('mine.design.series.' + value),
              }))}
            />
            <FormField
              sx={{ display: { xs: advancedFilters ? 'block' : 'none', md: 'block' } }}
              size="small"
              label={t('mine.filters.search')}
              value={search}
              onChange={(event) => updateFilter('q', event.target.value.slice(0, 160))}
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
          </Box>
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={0.75}
            sx={{ mt: 1.5, display: { xs: 'flex', md: 'none' } }}
          >
            {(['ALL', 'HOST', 'ATTENDEE'] as const).map((value) => (
              <ActionButton
                key={value}
                size="small"
                intent={roleFilter === value ? 'primary' : 'secondary'}
                aria-pressed={roleFilter === value}
                onClick={() => updateFilter('role', value)}
                sx={{ borderRadius: meetingShape.group }}
              >
                {t('mine.filters.role.' + value)}
              </ActionButton>
            ))}
            <ActionIconButton
              label={t('mine.filters.label')}
              aria-expanded={advancedFilters}
              onClick={() => setAdvancedFilters(!advancedFilters)}
            >
              <Search size={16} />
            </ActionIconButton>
          </Stack>
          {date && (
            <ActionButton intent="quiet" size="small" onClick={() => updateFilter('date', '')}>
              {t('mine.design.allDates')}
            </ActionButton>
          )}
        </Box>
        {!authenticated || query.isLoading ? (
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
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              gap={{ xs: 0.5, sm: 2 }}
              sx={{ mb: 1.5 }}
            >
              <Typography variant="body2" fontWeight="fontWeightBold">
                {t('mine.filters.resultCount', { count: filtered.length })}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: { xs: 'left', sm: 'right' } }}
              >
                {t('mine.filters.pageScope')}
              </Typography>
            </Stack>
            {evidencePartial && (
              <InlineFeedback severity="warning" sx={{ mb: 2 }}>
                {t('mine.design.partialEvidence')}
              </InlineFeedback>
            )}
            <Box
              data-testid="my-meetings-workspace"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0,1fr)',
                  lg:
                    inspectorOpen && selected ? 'minmax(0,2fr) minmax(280px,1fr)' : 'minmax(0,1fr)',
                },
                gap: 3,
                alignItems: 'start',
              }}
            >
              <Stack data-testid="my-meetings-list" gap={2} sx={{ minWidth: 0 }}>
                {groups.map((group) => (
                  <Stack key={group} gap={2}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography component="h2" variant="subtitle2">
                        <CalendarDays size={16} aria-hidden="true" />{' '}
                        {formatDate(
                          group + 'T12:00:00Z',
                          { dateStyle: 'full', timeZone: 'UTC' },
                          resolveSupportedLocale(i18n.language)
                        )}
                      </Typography>
                      <FormControlLabel
                        sx={{ m: 0, display: { xs: 'none', lg: 'inline-flex' } }}
                        label={
                          <Typography variant="caption">{t('mine.design.compact')}</Typography>
                        }
                        control={
                          <Switch
                            size="small"
                            checked={compact}
                            onChange={(_, value) => setCompact(value)}
                          />
                        }
                      />
                    </Stack>
                    {filtered
                      .filter((meeting) => meetingDateKey(meeting.startsAt, timeZone) === group)
                      .map((meeting) => (
                        <MyMeetingCard
                          key={meeting.meetingId}
                          meeting={meeting}
                          evidence={evidence[meeting.meetingId]}
                          selected={selected?.meetingId === meeting.meetingId}
                          compact={compact}
                          onSelect={() => {
                            updateFilter('meeting', meeting.meetingId);
                            setInspectorOpen(true);
                            if (!wide) setMobileInspectorOpen(true);
                          }}
                        />
                      ))}
                  </Stack>
                ))}
                {!filtered.length && (
                  <GuidedEmptyState
                    kind={items.length ? 'no-results' : 'empty'}
                    title={t(items.length ? 'mine.filters.noMatches' : 'mine.empty')}
                    description={t(
                      items.length ? 'mine.filters.noMatchesDescription' : 'mine.emptyDescription'
                    )}
                  />
                )}
                {pending.length > 0 && (
                  <Box
                    component="section"
                    aria-label={t('mine.design.pendingTab')}
                    sx={(theme) => ({
                      ...meetingInsetSurface(theme, 'warning'),
                      p: 2,
                      borderRadius: meetingShape.stage,
                    })}
                  >
                    <Typography component="h2" variant="subtitle2" sx={{ mb: 1.5 }}>
                      <Mail size={16} aria-hidden="true" />{' '}
                      {t('mine.design.pendingCount', { count: pending.length })}
                    </Typography>
                    <Stack gap={2}>
                      {pending.map((meeting) => (
                        <Stack key={meeting.meetingId} gap={1}>
                          <Typography variant="subtitle2">{meeting.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {meeting.organizerName}
                          </Typography>
                          <MyMeetingResponseActions
                            key={
                              meeting.meetingId +
                              '-' +
                              evidence[meeting.meetingId].preparation!.invitationRevision +
                              '-' +
                              evidence[meeting.meetingId].preparation!.myResponse!.version
                            }
                            meetingId={meeting.meetingId}
                            preparation={evidence[meeting.meetingId].preparation!}
                            onChanged={onChanged}
                          />
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
              {selected && inspectorOpen && wide && (
                <Stack
                  gap={2}
                  sx={{
                    display: { xs: 'none', lg: 'flex' },
                    minWidth: 0,
                    position: 'sticky',
                    top: 16,
                  }}
                >
                  <MyMeetingsInspector
                    key={selected.meetingId}
                    meeting={selected}
                    evidence={evidence[selected.meetingId]}
                    scope={scope}
                    onClose={() => setInspectorOpen(false)}
                    onChanged={onChanged}
                  />
                  <Stack
                    direction="row"
                    gap={1.5}
                    alignItems="center"
                    sx={(theme) => ({
                      bgcolor: 'background.paper',
                      p: 2,
                      borderRadius: meetingShape.card,
                      boxShadow: meetingSoftShadow(theme),
                    })}
                  >
                    <Timer size={24} aria-hidden="true" />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">{t('mine.design.loadedDuration')}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('mine.filters.pageScope')}
                      </Typography>
                    </Box>
                    <Chip
                      label={t('units.minutes', {
                        count: filtered.reduce((sum, meeting) => sum + meeting.durationMinutes, 0),
                      })}
                    />
                  </Stack>
                </Stack>
              )}
            </Box>
            {selected && !wide && mobileInspectorOpen && (
              <ContentDialog
                open
                title={t('mine.inspector.label')}
                closeLabel={t('actions.close')}
                onClose={() => setMobileInspectorOpen(false)}
                fullScreen
              >
                <MyMeetingsInspector
                  key={selected.meetingId}
                  meeting={selected}
                  evidence={evidence[selected.meetingId]}
                  scope={scope}
                  onClose={() => setMobileInspectorOpen(false)}
                  onChanged={onChanged}
                />
              </ContentDialog>
            )}
            {pagination && pagination.total > 1 && (
              <Stack
                direction="row"
                justifyContent="flex-end"
                alignItems="center"
                gap={1}
                sx={{ mt: 2 }}
              >
                <ActionIconButton
                  label={t('mine.previous')}
                  disabled={!pagination.hasPrevious}
                  onClick={() => updateFilter('page', String(Math.max(0, pagination.page - 1)))}
                >
                  <ChevronLeft size={17} />
                </ActionIconButton>
                <Typography
                  data-testid="my-meetings-page-status"
                  variant="caption"
                  color="text.secondary"
                >
                  {t('mine.page', { current: pagination.current, total: pagination.total })}
                </Typography>
                <ActionIconButton
                  label={t('mine.next')}
                  disabled={!pagination.hasNext}
                  onClick={() => updateFilter('page', String(pagination.page + 1))}
                >
                  <ChevronRight size={17} />
                </ActionIconButton>
              </Stack>
            )}
          </>
        )}
        <ContentDialog
          open={datePickerOpen}
          title={t('mine.design.date')}
          closeLabel={t('actions.close')}
          onClose={() => setDatePickerOpen(false)}
        >
          <Stack gap={2} sx={{ pt: 1 }}>
            <DatePickerField
              label={t('mine.design.date')}
              value={date || null}
              onValueChange={(value) => updateFilter('date', value ?? '')}
            />
            <ActionButton
              intent="secondary"
              onClick={() => {
                updateFilter('date', '');
                setDatePickerOpen(false);
              }}
            >
              {t('mine.design.allDates')}
            </ActionButton>
          </Stack>
        </ContentDialog>
      </PageCanvas>
    </Box>
  );
}
