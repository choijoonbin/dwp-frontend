import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { getWorkplaceDeviceProjection } from '@dwp-frontend/shared-utils/api/workplace-navigation-api';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatDate } from '@dwp-frontend/shared-i18n';

import {
  workplaceActiveSafetyFrame,
  workplaceMaskedSchedule,
  workplaceNavigationCopy,
} from './workplace-navigation-model';

import type {
  WorkplaceDeviceAvailability,
  WorkplaceDeviceProjection,
  WorkplaceDeviceScheduleItem,
  WorkplaceFloorResourceStatus,
} from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';
import type { WorkplaceNavigationLocale } from './workplace-navigation-model';

export type WorkplaceDeviceSurfaceProps = Readonly<{
  deviceId: string;
  deviceCredential: string;
  locale?: WorkplaceNavigationLocale;
  onWalkUpBook?: () => void;
  onCheckIn?: () => void;
  onEarlyEnd?: () => void;
}>;

function displayTime(value: string, locale: WorkplaceNavigationLocale) {
  return formatDate(
    value,
    {
      hour: '2-digit',
      minute: '2-digit',
    },
    locale
  );
}

function maskedSafetyActor(actorId: number, locale: WorkplaceNavigationLocale) {
  const suffix = String(actorId).slice(-2).padStart(2, '0');
  return locale === 'ko' ? `안전 운영자 ···${suffix}` : `Safety operator ···${suffix}`;
}

function ScheduleBlock({
  label,
  item,
  locale,
}: {
  label: string;
  item: WorkplaceDeviceScheduleItem | null;
  locale: WorkplaceNavigationLocale;
}) {
  const masked = workplaceMaskedSchedule(item, locale);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      {masked ? (
        <>
          <Typography variant="h6" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
            {masked.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {displayTime(masked.startsAt, locale)}–{displayTime(masked.endsAt, locale)}
            {masked.organizer ? ` · ${masked.organizer}` : ''}
          </Typography>
          {masked.privacyMasked && (
            <Chip
              size="small"
              variant="outlined"
              label={workplaceNavigationCopy(locale).privacy}
              sx={{ mt: 0.75 }}
            />
          )}
        </>
      ) : (
        <Typography color="text.secondary">—</Typography>
      )}
    </Box>
  );
}

function availabilityCopy(state: WorkplaceDeviceAvailability, locale: WorkplaceNavigationLocale) {
  const copy = workplaceNavigationCopy(locale);
  return state === 'AVAILABLE'
    ? copy.roomAvailable
    : state === 'OCCUPIED'
      ? copy.roomOccupied
      : copy.roomUnavailable;
}

function SafetyTakeover({
  projection,
  locale,
}: {
  projection: WorkplaceDeviceProjection;
  locale: WorkplaceNavigationLocale;
}) {
  const copy = workplaceNavigationCopy(locale);
  const frame = workplaceActiveSafetyFrame(
    projection.roomPanel?.safetyFrame ?? projection.statusBoard?.safetyFrame ?? null
  );
  if (!frame) return null;
  return (
    <Box
      role="alert"
      aria-live="assertive"
      data-testid="workplace-safety-takeover"
      sx={{
        minHeight: '100%',
        display: 'grid',
        alignContent: 'center',
        justifyItems: 'center',
        gap: 2,
        textAlign: 'center',
        p: { xs: 2, sm: 5 },
        bgcolor: '#861313',
        color: '#ffffff',
      }}
    >
      <ShieldAlert size={56} aria-hidden="true" />
      <Typography variant="overline" fontWeight={900}>
        {copy.safetyTakeover}
      </Typography>
      <Typography
        component="h1"
        variant="h3"
        fontWeight={900}
        sx={{ maxWidth: 920, fontSize: { xs: '1.75rem', sm: '3rem' } }}
      >
        {frame.message}
      </Typography>
      <Typography variant="h6" sx={{ maxWidth: 820 }}>
        {frame.direction}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="center">
        {[
          `${copy.asOf}: ${displayTime(frame.issuedAt, locale)}`,
          maskedSafetyActor(frame.issuedByActorId, locale),
        ].map((label) => (
          <Box
            key={label}
            sx={{
              border: '1px solid rgba(255,255,255,.72)',
              borderRadius: 10,
              px: 1.25,
              py: 0.5,
              color: '#ffffff',
              fontSize: 13,
            }}
          >
            {label}
          </Box>
        ))}
        {frame.offlineFallback && (
          <Stack
            direction="row"
            gap={0.5}
            alignItems="center"
            sx={{
              border: '1px solid #fff3cd',
              borderRadius: 10,
              px: 1.25,
              py: 0.5,
              color: '#ffffff',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={15} aria-hidden="true" /> {copy.offlineFallback}
          </Stack>
        )}
      </Stack>
      <Typography variant="body2">{copy.returnToNormal}</Typography>
    </Box>
  );
}

export function WorkplaceRoomPanelSurface({
  projection,
  locale = 'ko',
  onWalkUpBook,
  onCheckIn,
  onEarlyEnd,
}: {
  projection: WorkplaceDeviceProjection;
  locale?: WorkplaceNavigationLocale;
  onWalkUpBook?: () => void;
  onCheckIn?: () => void;
  onEarlyEnd?: () => void;
}) {
  const copy = workplaceNavigationCopy(locale);
  const panel = projection.roomPanel;
  if (!panel) return null;
  if (workplaceActiveSafetyFrame(panel.safetyFrame))
    return <SafetyTakeover projection={projection} locale={locale} />;
  const color =
    panel.availability === 'AVAILABLE'
      ? 'success.main'
      : panel.availability === 'OCCUPIED'
        ? 'warning.main'
        : 'error.main';
  return (
    <Box
      data-testid="workplace-room-panel"
      sx={{
        minHeight: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        p: { xs: 1.5, sm: 3 },
        bgcolor: 'background.paper',
        borderTop: '10px solid',
        borderColor: color,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box>
          <Typography component="h1" variant="h4" fontWeight={900}>
            {panel.device.displayName}
          </Typography>
          <Typography color="text.secondary">
            {panel.device.floorId} · {panel.device.resourceId}
          </Typography>
        </Box>
        <Chip
          icon={
            panel.availability === 'AVAILABLE' ? <CheckCircle2 size={17} /> : <Clock3 size={17} />
          }
          color={
            panel.availability === 'AVAILABLE'
              ? 'success'
              : panel.availability === 'OCCUPIED'
                ? 'warning'
                : 'error'
          }
          label={availabilityCopy(panel.availability, locale)}
        />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr' },
          alignContent: 'center',
          gap: { xs: 2, sm: 4 },
          py: 2,
        }}
      >
        <ScheduleBlock label={copy.current} item={panel.current} locale={locale} />
        <ScheduleBlock label={copy.next} item={panel.next} locale={locale} />
      </Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1}
      >
        <Typography variant="caption" color="text.secondary">
          {copy.asOf}: {displayTime(panel.asOf, locale)} · {panel.device.scheduleFreshness}
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {panel.walkUpBookingAllowed && (
            <ActionButton
              intent="primary"
              startIcon={<CalendarClock size={16} />}
              disabled={!onWalkUpBook}
              onClick={onWalkUpBook}
            >
              {copy.walkUp}
            </ActionButton>
          )}
          {panel.checkInAllowed && (
            <ActionButton intent="secondary" disabled={!onCheckIn} onClick={onCheckIn}>
              {copy.checkIn}
            </ActionButton>
          )}
          {panel.earlyEndAllowed && (
            <ActionButton intent="secondary" disabled={!onEarlyEnd} onClick={onEarlyEnd}>
              {copy.earlyEnd}
            </ActionButton>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

function BoardResource({
  resource,
  locale,
}: {
  resource: WorkplaceFloorResourceStatus;
  locale: WorkplaceNavigationLocale;
}) {
  const name = locale === 'ko' ? resource.nameKo : resource.nameEn;
  const zone = locale === 'ko' ? resource.zoneNameKo : resource.zoneNameEn;
  const direction = locale === 'ko' ? resource.directionKo : resource.directionEn;
  return (
    <Box
      component="li"
      sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 1, py: 1.25 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={750}>{name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {[zone, direction].filter(Boolean).join(' · ') || '—'}
        </Typography>
      </Box>
      <Chip
        size="small"
        color={
          resource.availability === 'AVAILABLE'
            ? 'success'
            : resource.availability === 'OCCUPIED'
              ? 'warning'
              : 'error'
        }
        label={availabilityCopy(resource.availability, locale)}
      />
    </Box>
  );
}

export function WorkplaceStatusBoardSurface({
  projection,
  locale = 'ko',
}: {
  projection: WorkplaceDeviceProjection;
  locale?: WorkplaceNavigationLocale;
}) {
  const copy = workplaceNavigationCopy(locale);
  const board = projection.statusBoard;
  if (!board) return null;
  if (workplaceActiveSafetyFrame(board.safetyFrame))
    return <SafetyTakeover projection={projection} locale={locale} />;
  return (
    <Box
      data-testid="workplace-status-board"
      sx={{
        minHeight: '100%',
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        p: { xs: 1.5, sm: 3 },
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box>
          <Typography component="h1" variant="h4" fontWeight={900}>
            {copy.boardTitle}
          </Typography>
          <Typography color="text.secondary">
            {board.device.displayName} · {board.device.floorId}
          </Typography>
        </Box>
        <MapPin aria-hidden="true" />
      </Stack>
      <Box
        aria-label={copy.boardTitle}
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, py: 2 }}
      >
        {[
          [copy.available, board.availableCount, 'success.main'],
          [copy.occupied, board.occupiedCount, 'warning.main'],
          [copy.unavailable, board.unavailableCount, 'error.main'],
        ].map(([label, value, color]) => (
          <Box
            key={String(label)}
            sx={{ textAlign: 'center', p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <Typography variant="h5" fontWeight={900} color={String(color)}>
              {value}
            </Typography>
            <Typography variant="caption">{label}</Typography>
          </Box>
        ))}
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, overflow: 'auto' }}>
        {board.resources.map((resource, index) => (
          <Box key={resource.resourceId}>
            <BoardResource resource={resource} locale={locale} />
            {index < board.resources.length - 1 && <Divider />}
          </Box>
        ))}
      </Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={0.5}
        sx={{ pt: 1.5 }}
      >
        {board.freshness !== 'FRESH' && (
          <InlineFeedback severity="warning">{copy.stale}</InlineFeedback>
        )}
        <Typography variant="caption" color="text.secondary">
          {copy.asOf}: {displayTime(board.asOf, locale)} · {board.freshness}
        </Typography>
      </Stack>
    </Box>
  );
}

export function WorkplaceDeviceSurface({
  deviceId,
  deviceCredential,
  locale = 'ko',
  onWalkUpBook,
  onCheckIn,
  onEarlyEnd,
}: WorkplaceDeviceSurfaceProps) {
  const copy = workplaceNavigationCopy(locale);
  const projectionQuery = useQuery({
    queryKey: ['workplace', 'device-projection', deviceId],
    queryFn: () => getWorkplaceDeviceProjection(deviceId, deviceCredential),
    enabled: Boolean(deviceId && deviceCredential),
    retry: false,
    refetchInterval: 15_000,
  });
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1440,
        mx: 'auto',
        aspectRatio: '16 / 9',
        minHeight: { xs: 300, sm: 480 },
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {projectionQuery.isLoading ? (
        <LoadingState label={copy.loading} />
      ) : projectionQuery.isError ? (
        <Box sx={{ p: 3 }}>
          <InlineFeedback
            severity="error"
            action={
              <ActionButton
                intent="quiet"
                startIcon={<RefreshCw size={15} />}
                onClick={() => void projectionQuery.refetch()}
              >
                {copy.retry}
              </ActionButton>
            }
          >
            {locale === 'ko'
              ? '장치 Projection을 확인할 수 없습니다. 이전 일정이나 안전 상태를 추정하지 않습니다.'
              : 'The device projection is unavailable. Previous schedule or safety state is not inferred.'}
          </InlineFeedback>
        </Box>
      ) : projectionQuery.data?.surface === 'ROOM_PANEL' ? (
        <WorkplaceRoomPanelSurface
          projection={projectionQuery.data}
          locale={locale}
          onWalkUpBook={onWalkUpBook}
          onCheckIn={onCheckIn}
          onEarlyEnd={onEarlyEnd}
        />
      ) : projectionQuery.data ? (
        <WorkplaceStatusBoardSurface projection={projectionQuery.data} locale={locale} />
      ) : null}
    </Box>
  );
}
