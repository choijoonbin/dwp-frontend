import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionButton, LoadingState, SectionHeader } from '@dwp-frontend/design-system';
import {
  calendarTeamSnapshotIsFresh,
  getCalendarTeamAvailabilitySnapshot,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale, resolveZonedDateKey } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { calendarHomeSurface, CALENDAR_HOME_ROW_RADIUS } from './calendar-home-surfaces';
import { calendarReadSourceState } from './calendar-read-source-state';
import { calendarInternalPath } from './calendar-schedule-state';

import type { CalendarTeamAvailabilitySnapshot } from '@dwp-frontend/shared-utils';
import type { CalendarReadSourceState } from './calendar-read-source-state';

const TEAM_POLL_MS = 30_000;

class InvalidTeamSnapshotError extends Error {}

function validSnapshot(data: CalendarTeamAvailabilitySnapshot, timeZone: string) {
  return (
    data.source === 'DWP_NATIVE_CALENDAR' &&
    data.scope === 'SHARED_WITH_ME' &&
    data.timeZone === timeZone &&
    calendarTeamSnapshotIsFresh(data) &&
    data.date === resolveZonedDateKey(data.generatedAt, timeZone)
  );
}

function expiryOf(data: CalendarTeamAvailabilitySnapshot) {
  return Math.min(Date.parse(data.validUntil), Date.parse(data.generatedAt) + TEAM_POLL_MS);
}

function formattedTime(value: string, language: string, timeZone: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? formatDate(
        date,
        { hour: '2-digit', minute: '2-digit', timeZone },
        resolveSupportedLocale(language)
      )
    : '—';
}

function TeamUnavailable({
  state,
  onRetry,
}: {
  state: CalendarReadSourceState;
  onRetry?: () => void;
}) {
  const { t } = useTranslation('calendar');
  return (
    <Stack spacing={1} sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary" role="status">
        {t(
          state === 'DENIED'
            ? 'workspace.team.denied'
            : state === 'STALE'
              ? 'workspace.team.expired'
              : 'workspace.team.unavailable'
        )}
      </Typography>
      {onRetry ? (
        <ActionButton
          intent="secondary"
          size="small"
          onClick={onRetry}
          sx={{ minHeight: 44, whiteSpace: 'normal' }}
        >
          {t('actions.retry')}
        </ActionButton>
      ) : null}
    </Stack>
  );
}

function TeamSnapshotQuery({
  tenantId,
  actorId,
  timeZone,
  language,
  currentSearch,
}: {
  tenantId: string;
  actorId: string;
  timeZone: string;
  language: string;
  currentSearch: string;
}) {
  const { t } = useTranslation('calendar');
  const queryClient = useQueryClient();
  const [epoch, setEpoch] = useState(0);
  const [blocked, setBlocked] = useState<CalendarReadSourceState | null>(null);
  const queryKey = useMemo(
    () => ['calendar', 'team-availability', tenantId, actorId, timeZone, epoch] as const,
    [actorId, epoch, tenantId, timeZone]
  );
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const data = await getCalendarTeamAvailabilitySnapshot(timeZone, signal);
      // Validate at receipt: an expired server response must never enter the cache.
      if (!validSnapshot(data, timeZone)) throw new InvalidTeamSnapshotError();
      return data;
    },
    enabled: blocked === null,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: TEAM_POLL_MS,
    refetchOnWindowFocus: true,
    meta: { accessSensitive: true, tenantId, actorId },
  });
  const sourceState = calendarReadSourceState({
    data: query.data,
    error: query.error,
    isError: query.isError,
    isPending: query.isPending,
  });
  // A previously validated snapshot aging out is a clean refresh, not a terminal
  // invalid-payload state. Mask identities even before the expiry timer is delivered.
  const agedOut = Boolean(query.data && Date.now() >= expiryOf(query.data));
  const state =
    blocked ??
    (query.error instanceof InvalidTeamSnapshotError
      ? 'STALE'
      : sourceState === 'READY' && query.data && !calendarTeamSnapshotIsFresh(query.data)
        ? agedOut
          ? 'LOADING'
          : 'STALE'
        : sourceState);
  const snapshot = state === 'READY' ? query.data : undefined;

  // Identity, parent authority, drawer closure, and unmount all discard this private cache.
  useEffect(
    () => () => {
      void queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.removeQueries({ queryKey, exact: true });
    },
    [queryClient, queryKey]
  );

  useEffect(() => {
    if (blocked || (state !== 'DENIED' && state !== 'UNAVAILABLE' && state !== 'STALE')) return;
    setBlocked(state);
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.removeQueries({ queryKey, exact: true });
  }, [blocked, queryClient, queryKey, state]);

  useEffect(() => {
    if (blocked || state === 'STALE' || sourceState !== 'READY' || !query.data) return undefined;
    // Do not extend a shorter sharing grant to the polling interval. Swap to a fresh,
    // uncached query at expiry; the old request and all old member data are discarded.
    const timer = window.setTimeout(
      () => {
        void queryClient.cancelQueries({ queryKey, exact: true });
        queryClient.removeQueries({ queryKey, exact: true });
        setEpoch((current) => current + 1);
      },
      Math.max(0, expiryOf(query.data) - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [blocked, query.data, queryClient, queryKey, sourceState, state]);

  if (state === 'LOADING') {
    return (
      <Box sx={{ mt: 1.5 }}>
        <LoadingState
          embedded
          variant="skeleton"
          label={t('workspace.team.loading')}
          skeletonHeights={[48, 48, 48]}
          skeletonGap={1}
        />
      </Box>
    );
  }
  if (!snapshot) {
    return (
      <TeamUnavailable
        state={state}
        onRetry={() => {
          setBlocked(null);
          setEpoch((current) => current + 1);
        }}
      />
    );
  }
  return (
    <Box data-calendar-team-state="READY">
      {snapshot.members.length ? (
        <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0, mt: 1.5 }}>
          {snapshot.members.slice(0, 3).map((member) => {
            const name = member.displayName?.trim() || t('workspace.team.unnamed');
            const available = member.status === 'AVAILABLE';
            return (
              <Box
                component="li"
                key={member.personPublicId}
                data-calendar-team-member={member.status}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1fr)',
                  gap: 1,
                  alignItems: 'start',
                }}
              >
                <Box
                  aria-hidden="true"
                  sx={(theme) => ({
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: CALENDAR_HOME_ROW_RADIUS,
                    bgcolor: alpha(theme.palette.primary.main, 0.09),
                    color: 'primary.main',
                    typography: 'caption',
                    fontWeight: 'fontWeightBold',
                    '@media (forced-colors: active)': {
                      border: '1px solid CanvasText',
                      color: 'CanvasText',
                      bgcolor: 'Canvas',
                    },
                  })}
                >
                  {Array.from(name)[0]}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="fontWeightMedium">
                    {name}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="p"
                    sx={{
                      color: available ? 'success.main' : 'text.secondary',
                      '@media (forced-colors: active)': { color: 'CanvasText' },
                    }}
                  >
                    {t(`workspace.team.status.${member.status}`)}
                  </Typography>
                  {!available && member.busyUntil ? (
                    <Typography component="p" variant="caption" color="text.secondary">
                      {t('workspace.team.until', {
                        time: formattedTime(member.busyUntil, language, timeZone),
                      })}
                    </Typography>
                  ) : null}
                  <ActionButton
                    component={Link}
                    to={calendarInternalPath(
                      `/calendar/availability?person=${encodeURIComponent(member.personPublicId)}`,
                      new URLSearchParams(currentSearch)
                    )}
                    aria-label={t('workspace.team.findTimeFor', { name })}
                    intent="quiet"
                    size="small"
                    endIcon={<ArrowUpRight size={14} aria-hidden="true" />}
                    sx={{
                      minHeight: 44,
                      maxWidth: 1,
                      whiteSpace: 'normal',
                      textAlign: 'start',
                      px: 0.5,
                    }}
                  >
                    {t('workspace.team.findTime')}
                  </ActionButton>
                </Box>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t('workspace.team.empty')}
          </Typography>
          <ActionButton
            component={Link}
            to={calendarInternalPath('/calendar/schedule', new URLSearchParams(currentSearch), {
              preserveScheduleState: true,
            })}
            intent="quiet"
            sx={{ minHeight: 44, whiteSpace: 'normal' }}
          >
            {t('workspace.team.manageSharing')}
          </ActionButton>
        </Stack>
      )}
      {snapshot.hasMore || snapshot.members.length > 3 ? (
        <Stack spacing={0.5} sx={{ mt: 1.25 }}>
          <Typography component="p" variant="caption" color="text.secondary">
            {t('workspace.team.more')}
          </Typography>
          <ActionButton
            component={Link}
            to={calendarInternalPath('/calendar/schedule', new URLSearchParams(currentSearch), {
              preserveScheduleState: true,
            })}
            intent="quiet"
            sx={{ minHeight: 44, whiteSpace: 'normal' }}
          >
            {t('workspace.team.manageSharing')}
          </ActionButton>
        </Stack>
      ) : null}
      <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 1 }}>
        {t('workspace.team.updated', {
          time: formattedTime(snapshot.generatedAt, language, timeZone),
          timeZone,
        })}
      </Typography>
    </Box>
  );
}

export function CalendarHomeTeamPanel({
  state,
  timeZone,
  language,
  currentSearch,
}: {
  state: CalendarReadSourceState;
  timeZone: string;
  language: string;
  currentSearch: string;
}) {
  const { t } = useTranslation('calendar');
  const auth = useAuth();
  const { hasPermission } = usePermissions();
  const tenantId = String(auth.user?.tenantId ?? '');
  const actorId = String(auth.user?.userId ?? '');
  const permitted =
    auth.isAuthenticated &&
    Boolean(tenantId && actorId) &&
    hasPermission('APP.CALENDAR', 'VIEW') &&
    hasPermission('APP.PEOPLE_DIRECTORY', 'VIEW');
  return (
    <Box
      component="section"
      aria-labelledby="calendar-home-team-title"
      data-testid="calendar-home-team-panel"
      sx={[calendarHomeSurface, { p: 2, overflowWrap: 'anywhere' }]}
    >
      <SectionHeader
        id="calendar-home-team-title"
        icon={UsersRound}
        title={t('workspace.team.title')}
      />
      <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
        {t('workspace.team.scope')}
      </Typography>
      {state === 'READY' && permitted ? (
        <TeamSnapshotQuery
          key={`${tenantId}:${actorId}:${timeZone}`}
          tenantId={tenantId}
          actorId={actorId}
          timeZone={timeZone}
          language={language}
          currentSearch={currentSearch}
        />
      ) : (
        <TeamUnavailable state={permitted ? state : 'DENIED'} />
      )}
    </Box>
  );
}
