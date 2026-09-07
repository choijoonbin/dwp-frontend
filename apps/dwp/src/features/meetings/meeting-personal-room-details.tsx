import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
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
  DoorOpen,
  History,
  LockKeyhole,
  MicOff,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { meetingSurface } from './meeting-visual-system';

function Section({
  title,
  id,
  icon,
  children,
}: {
  title: string;
  id: string;
  icon: typeof DoorOpen;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={(theme) => ({
        ...meetingSurface(theme),
        minWidth: 0,
        p: { xs: 2, md: 3 },
        boxShadow: theme.shadows[1],
      })}
    >
      <SectionHeader id={id} icon={icon} density="compact" glyph="plain" title={title} />
      <Box sx={{ mt: 2 }}>{children}</Box>
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
    <Stack gap={3}>
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
  room,
  history,
  page,
  onPage,
  busy,
  canUpdate,
  onRotate,
  onCheckDevices,
  refreshedAt,
}: {
  room: VideoMeetingPersonalRoom;
  history: UseQueryResult<VideoMeetingPersonalRoomSessionPage, Error>;
  page: number;
  onPage: (page: number) => void;
  busy: boolean;
  canUpdate: boolean;
  onRotate: () => void;
  onCheckDevices: () => void;
  refreshedAt: number;
}) {
  const { t, i18n } = useTranslation('meetings');
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
          <Stack gap={2.5}>
            {['waiting', 'scope', 'external'].map((key) => (
              <Stack key={key} direction="row" gap={1.5} alignItems="flex-start">
                <LockKeyhole size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">
                    {t(`personalRoom.policy.${key}Title`)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t(`personalRoom.policy.${key}Description`)}
                  </Typography>
                </Box>
              </Stack>
            ))}
            <InlineFeedback>{t('personalRoom.policy.fixedHint')}</InlineFeedback>
          </Stack>
        </Section>
      }
      current={
        <Section title={t('personalRoom.current.title')} id="personal-room-current" icon={Radio}>
          <Stack gap={1.5}>
            <Typography variant="subtitle1">
              {t(
                room.currentMeetingId
                  ? 'personalRoom.current.available'
                  : 'personalRoom.current.none'
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                room.currentMeetingId
                  ? 'personalRoom.current.continueHint'
                  : 'personalRoom.current.emptyHint'
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('personalRoom.current.snapshot', { at: date(refreshedAt), timeZone })}
            </Typography>
          </Stack>
        </Section>
      }
      rotate={
        <Section title={t('personalRoom.rotate.title')} id="personal-room-rotate" icon={RefreshCw}>
          <Stack gap={2}>
            <Typography variant="body2" color="text.secondary">
              {t('personalRoom.rotate.description')}
            </Typography>
            <ActionButton
              intent="secondary"
              startIcon={<RefreshCw size={16} />}
              disabled={busy || !canUpdate}
              onClick={onRotate}
            >
              {t('personalRoom.rotate.action')}
            </ActionButton>
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
            <Stack direction="row" gap={1} alignItems="center">
              <MicOff size={18} aria-hidden="true" />
              <VideoOff size={18} aria-hidden="true" />
              <Typography variant="body2">{t('personalRoom.defaults.media')}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
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
        <Section title={t('personalRoom.history.title')} id="personal-room-history" icon={History}>
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
            <Stack component="ul" gap={0} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {history.data.items.map((session) => (
                <Box
                  component="li"
                  key={session.meetingId}
                  sx={{ py: 1.5, '& + &': { borderTop: 1, borderColor: 'divider' } }}
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
                  <Typography variant="subtitle2" sx={{ my: 0.75, overflowWrap: 'anywhere' }}>
                    {session.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('personalRoom.history.revision', { revision: session.invitationRevision })}
                  </Typography>
                  {session.endedAt && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
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
