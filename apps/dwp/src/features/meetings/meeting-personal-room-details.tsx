import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getVideoMeetingPreferences } from '@dwp-frontend/shared-utils/api/video-meeting-preferences-api';
import {
  formatDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import { readRegionalPreference } from '@dwp-frontend/shared-utils/regional-preference';
import type {
  VideoMeetingPersonalRoom,
  VideoMeetingPersonalRoomSessionPage,
} from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
  SectionHeader,
} from '@dwp-frontend/design-system';
import {
  ChevronDown,
  ChevronRight,
  DoorOpen,
  History,
  LockKeyhole,
  MicOff,
  Moon,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import { meetingSurface, meetingShape, meetingSoftShadow } from './meeting-visual-system';

function Section({
  title,
  id,
  icon,
  compactMobile = false,
  action,
  children,
}: {
  title: string;
  id: string;
  icon: typeof DoorOpen;
  compactMobile?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={(theme) => ({
        ...meetingSurface(theme),
        borderRadius: meetingShape.group,
        minWidth: 0,
        p: { xs: 2, md: 3 },
        boxShadow: (theme) => meetingSoftShadow(theme),
      })}
    >
      <Box sx={{ display: compactMobile ? { xs: 'none', md: 'block' } : 'block' }}>
        <SectionHeader
          id={id}
          icon={icon}
          density="compact"
          glyph="surface"
          title={title}
          meta={action}
        />
      </Box>
      <Box sx={{ mt: compactMobile ? { xs: 0, md: 2 } : 2 }}>{children}</Box>
    </Box>
  );
}

function PersonalRoomLayout({
  policy,
  current,
  rotate,
  defaults,
  history,
  isolation,
  supplementalLabel,
}: Record<'policy' | 'current' | 'rotate' | 'defaults' | 'history' | 'isolation', ReactNode> & {
  supplementalLabel: string;
}) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  // Independent desktop columns avoid artificial empty rows. Mobile DOM order follows its layout.
  return wide ? (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)',
        gap: 3,
        alignItems: 'start',
      }}
    >
      <Stack gap={3}>
        {policy}
        {rotate}
        {defaults}
      </Stack>
      <Stack gap={3}>
        {current}
        {history}
        {isolation}
      </Stack>
    </Box>
  ) : (
    <Stack gap={2}>
      {current}
      {policy}
      {rotate}
      {history}
      <Box
        component="details"
        data-testid="personal-room-supplemental-settings"
        sx={(theme) => ({
          ...meetingSurface(theme),
          overflow: 'hidden',
          boxShadow: theme.shadows[1],
          '&[open] > summary': {
            borderBottom: 1,
            borderColor: 'divider',
          },
          '&[open] > summary [data-disclosure-indicator]': {
            transform: 'rotate(180deg)',
          },
        })}
      >
        <Stack
          component="summary"
          direction="row"
          alignItems="center"
          gap={1}
          sx={{
            minHeight: 52,
            px: 2,
            py: 1,
            cursor: 'pointer',
            listStyle: 'none',
            '&::-webkit-details-marker': { display: 'none' },
            '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
          }}
        >
          <Settings2 size={18} aria-hidden="true" />
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {supplementalLabel}
          </Typography>
          <Box
            component="span"
            data-disclosure-indicator
            aria-hidden="true"
            sx={{ display: 'inline-flex', color: 'text.secondary' }}
          >
            <ChevronDown size={18} />
          </Box>
        </Stack>
        <Stack gap={2} sx={{ p: 1.5 }}>
          {defaults}
          {isolation}
        </Stack>
      </Box>
    </Stack>
  );
}

export function MeetingPersonalRoomDetails({
  scope,
  room,
  history,
  page,
  onPage,
  busy,
  canUpdate,
  onRotate,
  onCheckDevices,
  onOpenMeeting,
  onViewAll,
  refreshedAt,
}: {
  scope: string;
  room: VideoMeetingPersonalRoom;
  history: UseQueryResult<VideoMeetingPersonalRoomSessionPage, Error>;
  page: number;
  onPage: (page: number) => void;
  busy: boolean;
  canUpdate: boolean;
  onRotate: () => void;
  onCheckDevices: () => void;
  onOpenMeeting: (meetingId: string) => void;
  onViewAll: () => void;
  refreshedAt: number;
}) {
  const { t, i18n } = useTranslation('meetings');
  const preferences = useQuery({
    queryKey: ['meetings', 'personal-room-preferences', scope],
    queryFn: () => getVideoMeetingPreferences(),
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const savedPreferences = preferences.isError ? undefined : preferences.data;
  const [regional, setRegional] = useState(readRegionalPreference);
  useEffect(() => {
    const refresh = () => setRegional(readRegionalPreference());
    window.addEventListener('dwp:regional-preference-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('dwp:regional-preference-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const timeZone =
    regional.timeZone === 'system' ? resolveSystemTimeZone('UTC') : regional.timeZone;
  const date = (value: string | number) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short', timeZone },
      resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language)
    );
  return (
    <PersonalRoomLayout
      supplementalLabel={`${t('personalRoom.defaults.title')} · ${t('personalRoom.isolation.title')}`}
      policy={
        <Section title={t('personalRoom.policy.title')} id="personal-room-policy" icon={DoorOpen}>
          <Stack gap={1.25}>
            {['waiting', 'scope', 'external'].map((key) => (
              <Stack
                key={key}
                direction="row"
                gap={1.25}
                alignItems="flex-start"
                sx={(theme) => ({
                  p: 1.5,
                  borderRadius: meetingShape.control,
                  bgcolor: alpha(theme.palette.primary.main, 0.045),
                })}
              >
                <LockKeyhole size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2">
                    {t(`personalRoom.policy.${key}Title`)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: { xs: 'none', md: 'block' } }}
                  >
                    {t(`personalRoom.policy.${key}Description`)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: { xs: 'block', md: 'none' } }}
                  >
                    {t(`stitch.personal.policyMobile.${key}`)}
                  </Typography>
                </Box>
                {key === 'waiting' ? (
                  <Switch
                    checked
                    disabled
                    slotProps={{ input: { 'aria-label': t('personalRoom.policy.waitingTitle') } }}
                    sx={{ mr: -1 }}
                  />
                ) : (
                  <Chip
                    size="small"
                    label={t('stitch.personal.' + (key === 'scope' ? 'internalOnly' : 'blocked'))}
                    color={key === 'scope' ? 'primary' : 'error'}
                    sx={{ maxWidth: 88, mt: 0.25 }}
                  />
                )}
              </Stack>
            ))}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <InlineFeedback>{t('personalRoom.policy.fixedHint')}</InlineFeedback>
            </Box>
          </Stack>
        </Section>
      }
      current={
        <Section
          title={t('personalRoom.current.title')}
          id="personal-room-current"
          icon={Radio}
          compactMobile
        >
          <Stack
            gap={1.25}
            direction={{ xs: 'row', md: 'column' }}
            alignItems="center"
            sx={(theme) => ({
              textAlign: { xs: 'left', md: 'center' },
              py: { xs: 0, md: 3 },
              px: { xs: 0, md: 2 },
              borderRadius: meetingShape.card,
              bgcolor: { xs: 'transparent', md: alpha(theme.palette.primary.main, 0.055) },
            })}
          >
            <Box
              sx={{
                p: 1.5,
                borderRadius: meetingShape.group,
                bgcolor: 'background.paper',
                display: 'flex',
                color: 'text.secondary',
              }}
            >
              <Moon size={28} aria-hidden="true" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ typography: { xs: 'body2', md: 'subtitle1' } }}>
                {t(
                  room.currentMeetingId
                    ? 'personalRoom.current.available'
                    : 'personalRoom.current.none'
                )}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'block', md: 'none' } }}
              >
                {t('stitch.personal.waitingMobile')}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={t('stitch.personal.waitingUnavailable')}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', md: 'block' } }}
            >
              {t(
                room.currentMeetingId
                  ? 'personalRoom.current.continueHint'
                  : 'personalRoom.current.emptyHint'
              )}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', md: 'block' } }}
            >
              {t('personalRoom.current.snapshot', { at: date(refreshedAt), timeZone })}
            </Typography>
          </Stack>
        </Section>
      }
      rotate={
        <Section
          title={t('personalRoom.rotate.title')}
          id="personal-room-rotate"
          icon={RefreshCw}
          compactMobile
        >
          <Stack gap={1.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={(theme) => ({
                p: { xs: 0, md: 1.5 },
                borderRadius: meetingShape.control,
                bgcolor: { xs: 'transparent', md: alpha(theme.palette.primary.main, 0.055) },
              })}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: { xs: 'none', md: 'block' } }}
              >
                {t('personalRoom.rotate.description')}
              </Typography>
              <Typography variant="subtitle2" sx={{ display: { xs: 'block', md: 'none' } }}>
                {t('personalRoom.rotate.title')}
              </Typography>
              <ActionButton
                intent="secondary"
                startIcon={<RefreshCw size={16} />}
                disabled={busy || !canUpdate}
                onClick={onRotate}
              >
                {t('personalRoom.rotate.action')}
              </ActionButton>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t('personalRoom.updatedAt', { at: date(room.updatedAt), timeZone })}
            </Typography>
            {!canUpdate && <InlineFeedback>{t('personalRoom.updatePermission')}</InlineFeedback>}
          </Stack>
        </Section>
      }
      defaults={
        <Section
          title={t('personalRoom.defaults.title')}
          id="personal-room-defaults"
          icon={Settings2}
        >
          <Stack gap={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
                gap: 1,
              }}
            >
              {(
                [
                  { key: 'microphoneOff', icon: MicOff },
                  { key: 'cameraOff', icon: VideoOff },
                ] as const
              ).map(({ key, icon: Icon }) => (
                <Stack
                  key={key}
                  direction="row"
                  gap={1}
                  alignItems="center"
                  sx={(theme) => ({
                    p: 1.5,
                    borderRadius: meetingShape.control,
                    bgcolor: alpha(theme.palette.primary.main, 0.045),
                  })}
                >
                  <Icon size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{t('preferences.join.' + key)}</Typography>
                    {!savedPreferences && (
                      <Typography variant="caption" color="text.secondary">
                        {t('stitch.personal.preferenceUnavailable')}
                      </Typography>
                    )}
                  </Box>
                  {savedPreferences && (
                    <Switch
                      checked={savedPreferences[key]}
                      disabled
                      slotProps={{ input: { 'aria-label': t('preferences.join.' + key) } }}
                    />
                  )}
                </Stack>
              ))}
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={(theme) => ({
                p: 1.5,
                borderRadius: meetingShape.control,
                bgcolor: alpha(theme.palette.primary.main, 0.045),
              })}
            >
              {t('personalRoom.defaults.consent')}
            </Typography>
            <ActionButton
              intent="quiet"
              startIcon={<Settings2 size={16} />}
              disabled={busy}
              onClick={onCheckDevices}
            >
              {t('personalRoom.defaults.open')}
            </ActionButton>
          </Stack>
        </Section>
      }
      history={
        <Section
          title={t('personalRoom.history.title')}
          id="personal-room-history"
          icon={History}
          action={
            <ActionButton intent="quiet" size="small" disabled={busy} onClick={onViewAll}>
              {t('mine.title')} · {t('actions.viewAll')}
            </ActionButton>
          }
        >
          {history.isPending ? (
            <LoadingState
              label={t('personalRoom.history.loading')}
              variant="skeleton"
              skeletonRows={3}
              size="compact"
              embedded
            />
          ) : history.isError ? (
            <ErrorState
              title={t('personalRoom.history.error')}
              retryLabel={t('actions.retry')}
              onRetry={() => void history.refetch()}
              size="compact"
            />
          ) : !history.data?.items.length ? (
            <EmptyState
              title={t('personalRoom.history.empty')}
              description={t('personalRoom.history.emptyDescription')}
              size="compact"
            />
          ) : (
            <Stack component="ul" gap={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {history.data.items.map((session) => (
                <Box
                  component="li"
                  key={session.meetingId}
                  sx={(theme) => ({
                    p: 1.5,
                    borderRadius: meetingShape.control,
                    bgcolor: alpha(theme.palette.primary.main, 0.055),
                  })}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      {date(session.createdAt)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={session.lifecycleState === 'LIVE' ? 'success.main' : 'text.secondary'}
                    >
                      {t(`personalRoom.history.states.${session.lifecycleState}`)}
                    </Typography>
                  </Stack>
                  <ActionButton
                    intent="quiet"
                    endIcon={<ChevronRight size={17} aria-hidden="true" />}
                    disabled={busy || history.isFetching}
                    onClick={() => onOpenMeeting(session.meetingId)}
                    sx={{
                      px: 0,
                      my: 0.75,
                      width: '100%',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      whiteSpace: 'normal',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                      {session.title}
                    </Typography>
                  </ActionButton>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', md: 'block' } }}
                  >
                    {t('personalRoom.history.revision', { revision: session.invitationRevision })}
                  </Typography>
                  {session.endedAt && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: { xs: 'none', md: 'block' } }}
                    >
                      {t('personalRoom.history.endedAt', { at: date(session.endedAt) })}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
          {history.data && history.data.total > 5 && (
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 2 }}
            >
              <ActionButton
                size="small"
                intent="quiet"
                disabled={page === 0 || history.isFetching || busy}
                onClick={() => onPage(page - 1)}
              >
                {t('personalRoom.history.previous')}
              </ActionButton>
              <Typography variant="caption">
                {t('personalRoom.history.page', {
                  page: page + 1,
                  total: Math.ceil(history.data.total / 5),
                })}
              </Typography>
              <ActionButton
                size="small"
                intent="quiet"
                disabled={(page + 1) * 5 >= history.data.total || history.isFetching || busy}
                onClick={() => onPage(page + 1)}
              >
                {t('personalRoom.history.next')}
              </ActionButton>
            </Stack>
          )}
        </Section>
      }
      isolation={
        <Section
          title={t('personalRoom.isolation.title')}
          id="personal-room-isolation"
          icon={ShieldCheck}
        >
          <Typography variant="body2" color="text.secondary">
            {t('personalRoom.isolation.description')}
          </Typography>
        </Section>
      }
    />
  );
}
