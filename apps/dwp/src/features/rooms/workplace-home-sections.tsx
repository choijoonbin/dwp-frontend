import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Armchair,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock3,
  Focus,
  LockKeyhole,
  LogIn,
  MapPin,
  MapPinned,
  Monitor,
  Package,
  Phone,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  WorkplaceHomeSectionHeader as SectionHeader,
  WorkplaceHomeSectionShell as SectionShell,
} from './workplace-home-section-frame';
import { WorkplaceHomeWorkloadBar } from './workplace-home-workload-bar';

import type {
  WorkplaceHomeAgendaItem,
  WorkplaceHomeAttention,
  WorkplaceHomeAvailability,
  WorkplaceHomeModel,
  WorkplaceHomeWeekDay,
} from './workplace-home-model';
import type { WorkplaceResourceType } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

const RESOURCE_ICONS: Record<WorkplaceResourceType, LucideIcon> = {
  ROOM: UsersRound,
  DESK: Monitor,
  LOCKER: LockKeyhole,
  PARKING: CarFront,
  FOCUS_POD: BriefcaseBusiness,
  PHONE_BOOTH: Phone,
  EQUIPMENT: Package,
};

const AGENDA_ICONS: Record<WorkplaceHomeAgendaItem['kind'], LucideIcon> = {
  WORKSPACE: Armchair,
  MEETING: UsersRound,
  FOCUS: Focus,
  TASK: CheckCircle2,
  OUT_OF_OFFICE: MapPinned,
  REMINDER: CalendarClock,
};

function nextActionCopy(model: WorkplaceHomeModel, t: ReturnType<typeof useTranslation>['t']) {
  const action = model.nextAction;
  if (action.kind === 'CHECK_IN') {
    return {
      eyebrow: t('workplace.home.nextAction.checkInEyebrow'),
      title: t('workplace.home.nextAction.checkInTitle', { resource: action.booking.resourceName }),
      description: t('workplace.home.nextAction.checkInDescription', {
        location: [action.booking.siteName, action.booking.floorName].filter(Boolean).join(' · '),
      }),
      time: action.booking.checkInClosesAt,
      location: [action.booking.siteName, action.booking.floorName].filter(Boolean).join(' · '),
    };
  }
  if (action.kind === 'OPEN_NEXT') {
    return {
      eyebrow: t('workplace.home.nextAction.upNextEyebrow'),
      title: action.item.title,
      description: t('workplace.home.nextAction.upNextDescription'),
      time: action.item.startsAt,
      location: action.item.location,
    };
  }
  if (action.kind === 'BOOK_SPACE') {
    return {
      eyebrow: t('workplace.home.nextAction.readyEyebrow'),
      title: t('workplace.home.nextAction.bookTitle'),
      description: t('workplace.home.nextAction.bookDescription', {
        count: model.bookableCount,
      }),
      time: null,
      location: [model.selectedSiteName, model.selectedFloorName].filter(Boolean).join(' · '),
    };
  }
  if (action.kind === 'BROWSE_SPACE') {
    return {
      eyebrow: t('workplace.home.nextAction.browseEyebrow'),
      title: t('workplace.home.nextAction.browseTitle'),
      description: t('workplace.home.nextAction.browseDescription', {
        count: model.availableCount,
      }),
      time: null,
      location: [model.selectedSiteName, model.selectedFloorName].filter(Boolean).join(' · '),
    };
  }
  if (['NO_SITE', 'NO_FLOOR', 'NO_RESOURCE'].includes(action.kind)) {
    const key =
      action.kind === 'NO_FLOOR'
        ? 'noFloor'
        : action.kind === 'NO_RESOURCE'
          ? 'noResource'
          : 'noSite';
    return {
      eyebrow: t(`workplace.home.nextAction.${key}Eyebrow`),
      title: t(`workplace.home.nextAction.${key}Title`),
      description: t(`workplace.home.nextAction.${key}Description`),
      time: null,
      location: '',
    };
  }
  return {
    eyebrow: t('workplace.home.nextAction.clearEyebrow'),
    title: t('workplace.home.nextAction.clearTitle'),
    description: t('workplace.home.nextAction.clearDescription'),
    time: null,
    location: [model.selectedSiteName, model.selectedFloorName].filter(Boolean).join(' · '),
  };
}

function AvailabilityPulse({ items }: { items: readonly WorkplaceHomeAvailability[] }) {
  const { t } = useTranslation('rooms');
  return (
    <Stack component="ul" spacing={1.25} sx={{ p: 0, m: 0, listStyle: 'none' }}>
      {items.slice(0, 4).map((item) => {
        const Icon = RESOURCE_ICONS[item.type];
        const percent = item.total ? Math.round((item.available / item.total) * 100) : 0;
        return (
          <Box component="li" key={item.type}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Stack direction="row" alignItems="center" spacing={0.75} minWidth={0}>
                <Icon size={14} aria-hidden="true" />
                <Typography
                  variant="caption"
                  fontWeight={700}
                  data-testid="workplace-availability-label"
                >
                  {t(`workplace.resourceTypes.${item.type}`)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {t('workplace.home.availability.pulseCount', {
                  open: item.available,
                  bookable: item.bookable,
                })}
              </Typography>
            </Stack>
            <Box
              role="meter"
              aria-label={t('workplace.home.availability.meterLabel', {
                type: t(`workplace.resourceTypes.${item.type}`),
                available: item.available,
                bookable: item.bookable,
                total: item.total,
              })}
              aria-valuemin={0}
              aria-valuemax={item.total}
              aria-valuenow={item.available}
              sx={{
                mt: 0.65,
                height: 6,
                bgcolor: 'action.hover',
                overflow: 'hidden',
                borderRadius: 0.5,
              }}
            >
              <Box
                aria-hidden="true"
                sx={{ width: `${percent}%`, height: 1, bgcolor: 'success.main' }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export function WorkplaceDayBrief({
  model,
  availabilityState,
  checkInState,
  decisionComplete,
  canManage,
  checkInBusy,
  onRefresh,
  onCheckIn,
}: {
  model: WorkplaceHomeModel;
  availabilityState: 'READY' | 'STALE' | 'UNAVAILABLE';
  checkInState: 'AVAILABLE' | 'READ_ONLY' | 'UNVERIFIED';
  decisionComplete: boolean;
  canManage: boolean;
  checkInBusy: boolean;
  onRefresh: () => void;
  onCheckIn: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const setupAction = ['NO_SITE', 'NO_FLOOR', 'NO_RESOURCE'].includes(model.nextAction.kind);
  const setupActionLabel =
    model.nextAction.kind === 'NO_FLOOR'
      ? t('workplace.home.availability.configureFloor')
      : model.nextAction.kind === 'NO_RESOURCE'
        ? t('workplace.home.availability.configureResources')
        : t('workplace.home.availability.configureSite');
  const needsDecisionRefresh =
    !decisionComplete ||
    (availabilityState !== 'READY' &&
      ['BOOK_SPACE', 'BROWSE_SPACE', 'NONE'].includes(model.nextAction.kind));
  const copy = needsDecisionRefresh
    ? {
        eyebrow: t('workplace.home.nextAction.verifyEyebrow'),
        title: t('workplace.home.nextAction.verifyTitle'),
        description: t('workplace.home.nextAction.verifyDescription'),
        time: null,
        location: '',
      }
    : nextActionCopy(model, t);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const checkInAction = model.nextAction.kind === 'CHECK_IN';
  return (
    <Box
      component="section"
      aria-labelledby="workplace-day-brief"
      data-testid="workplace-day-brief"
      sx={(theme) => ({
        mt: 3,
        minHeight: 218,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(300px, 0.75fr)' },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.025),
        overflow: 'hidden',
      })}
    >
      <Box sx={{ px: { xs: 2.25, md: 3.25 }, py: { xs: 2.5, md: 3 }, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" color="primary.main">
          {checkInAction ? <LogIn size={16} /> : <CalendarClock size={16} />}
          <Typography variant="overline">{copy.eyebrow}</Typography>
        </Stack>
        <Typography
          id="workplace-day-brief"
          component="h2"
          sx={{
            mt: 0.75,
            fontSize: { xs: '1.4375rem', md: '1.75rem' },
            lineHeight: 1.22,
            fontWeight: 760,
          }}
        >
          {copy.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.85, maxWidth: 760 }}>
          {copy.description}
        </Typography>
        {(copy.time || copy.location) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.7, sm: 2 }}
            sx={{ mt: 1.5 }}
          >
            {copy.time && (
              <Stack direction="row" spacing={0.7} alignItems="center">
                <Clock3 size={15} aria-hidden="true" />
                <Typography variant="body2" fontWeight={650}>
                  {formatDate(copy.time, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
                </Typography>
              </Stack>
            )}
            {copy.location && (
              <Stack direction="row" spacing={0.7} alignItems="center">
                <MapPin size={15} aria-hidden="true" />
                <Typography variant="body2" fontWeight={650}>
                  {copy.location}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}
        <Stack direction="row" gap={1} useFlexGap flexWrap="wrap" sx={{ mt: 2.25 }}>
          {checkInAction && checkInState === 'AVAILABLE' ? (
            <ActionButton
              intent="primary"
              startIcon={<LogIn size={17} />}
              loading={checkInBusy}
              onClick={onCheckIn}
            >
              {t('workplace.home.nextAction.checkIn')}
            </ActionButton>
          ) : checkInAction && checkInState === 'UNVERIFIED' ? (
            <ActionButton intent="primary" onClick={onRefresh}>
              {t('workplace.home.nextAction.verify')}
            </ActionButton>
          ) : checkInAction ? (
            <ActionButton component={Link} to={model.nextAction.path} intent="primary">
              {t('workplace.home.nextAction.viewBooking')}
            </ActionButton>
          ) : needsDecisionRefresh ? (
            <ActionButton intent="primary" onClick={onRefresh}>
              {t('workplace.home.nextAction.verify')}
            </ActionButton>
          ) : setupAction ? (
            canManage ? (
              <ActionButton
                component={Link}
                to="/workplace/admin/locations"
                intent="primary"
                endIcon={<ArrowRight size={16} />}
              >
                {setupActionLabel}
              </ActionButton>
            ) : null
          ) : (
            <ActionButton
              component={Link}
              to={model.nextAction.path}
              intent="primary"
              endIcon={<ArrowRight size={16} />}
            >
              {t(
                model.nextAction.kind === 'OPEN_NEXT'
                  ? 'workplace.home.nextAction.open'
                  : 'workplace.home.findSpace'
              )}
            </ActionButton>
          )}
          {model.nextAction.kind !== 'BOOK_SPACE' &&
            model.nextAction.kind !== 'BROWSE_SPACE' &&
            model.nextAction.kind !== 'NONE' &&
            !setupAction && (
              <ActionButton component={Link} to={model.discoveryPath} intent="secondary">
                {t('workplace.home.findSpace')}
              </ActionButton>
            )}
          {checkInAction && checkInState === 'UNVERIFIED' && (
            <ActionButton component={Link} to={model.nextAction.path} intent="secondary">
              {t('workplace.home.nextAction.viewBooking')}
            </ActionButton>
          )}
        </Stack>
        {checkInAction && checkInState !== 'AVAILABLE' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t(
              checkInState === 'READ_ONLY'
                ? 'workplace.home.nextAction.readOnlyNotice'
                : 'workplace.home.nextAction.unverifiedNotice'
            )}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          px: { xs: 2.25, md: 2.75 },
          py: { xs: 2.25, md: 3 },
          borderTop: { xs: 1, lg: 0 },
          borderLeft: { xs: 0, lg: 1 },
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {t('workplace.home.availability.scope')}
        </Typography>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 0.25 }}>
          {[model.selectedSiteName, model.selectedFloorName].filter(Boolean).join(' · ') ||
            t('workplace.home.availability.noScope')}
        </Typography>
        {availabilityState !== 'READY' ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {t(
              availabilityState === 'STALE'
                ? 'workplace.home.availability.staleDescription'
                : 'workplace.home.availability.unavailableDescription'
            )}
          </Typography>
        ) : model.selectedFloorPlan ? (
          <Box
            component="img"
            src={model.selectedFloorPlan}
            alt={t('workplace.home.availability.floorPlanAlt', {
              scope: [model.selectedSiteName, model.selectedFloorName].filter(Boolean).join(' · '),
            })}
            sx={{ mt: 1.5, width: 1, height: 112, objectFit: 'contain', bgcolor: 'action.hover' }}
          />
        ) : model.availability.length ? (
          <Box sx={{ mt: 1.5 }}>
            <AvailabilityPulse items={model.availability} />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {t('workplace.home.availability.noData')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function WorkplaceTodayFlow({
  agenda,
  complete,
}: {
  agenda: readonly WorkplaceHomeAgendaItem[];
  complete: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <SectionShell labelledBy="workplace-today-flow">
      <SectionHeader
        id="workplace-today-flow"
        icon={CalendarDays}
        title={t('workplace.home.agenda.title')}
        description={t('workplace.home.agenda.description')}
        action={
          <ActionButton component={Link} to="/workplace/my-bookings" intent="quiet" size="small">
            {t('workplace.home.openBookings')}
          </ActionButton>
        }
      />
      <Divider />
      {!complete && (
        <Typography
          color="warning.main"
          variant="caption"
          sx={{ display: 'block', px: 2.5, pt: 1.5 }}
        >
          {t('workplace.home.agenda.partial')}
        </Typography>
      )}
      {agenda.length ? (
        <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {agenda.slice(0, 6).map((item, index) => {
            const Icon = AGENDA_ICONS[item.kind];
            return (
              <Box
                component="li"
                key={item.key}
                sx={{ borderTop: index ? 1 : 0, borderColor: 'divider' }}
              >
                <ButtonBase
                  component={Link}
                  to={item.path}
                  sx={{
                    width: 1,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '50px 22px minmax(0, 1fr) 16px',
                      sm: '70px 26px minmax(0, 1fr) auto',
                    },
                    gap: { xs: 0.75, sm: 1 },
                    alignItems: 'center',
                    px: { xs: 2, md: 2.5 },
                    py: 1.5,
                    color: 'text.primary',
                    textAlign: 'left',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Typography variant="caption" fontWeight={800} color="primary.main">
                    {formatDate(item.startsAt, { hour: '2-digit', minute: '2-digit' }, locale)}
                  </Typography>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'text.secondary',
                    }}
                  >
                    <Icon size={15} />
                  </Box>
                  <Box minWidth={0}>
                    <Typography
                      variant="body2"
                      fontWeight={750}
                      data-testid="workplace-agenda-title"
                    >
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {item.location || t(`workplace.home.agenda.kinds.${item.kind}`)}
                    </Typography>
                  </Box>
                  <ArrowRight size={15} aria-hidden="true" />
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ px: 2.5, py: 3.5 }}>
          <Typography fontWeight={750}>
            {t(
              complete
                ? 'workplace.home.agenda.emptyTitle'
                : 'workplace.home.agenda.unavailableTitle'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(
              complete
                ? 'workplace.home.agenda.emptyDescription'
                : 'workplace.home.agenda.unavailableDescription'
            )}
          </Typography>
        </Box>
      )}
    </SectionShell>
  );
}

export function WorkplaceReadySpaces({
  model,
  state,
  canManage,
  refreshing,
  onRefresh,
}: {
  model: WorkplaceHomeModel;
  state: 'READY' | 'STALE' | 'UNAVAILABLE';
  canManage: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('rooms');
  const scopeKey =
    model.scopeState === 'NO_FLOOR'
      ? 'noFloor'
      : model.scopeState === 'NO_RESOURCE'
        ? 'noResource'
        : 'noSite';
  const hasScope = model.scopeState === 'READY';
  return (
    <SectionShell labelledBy="workplace-ready-spaces">
      <SectionHeader
        id="workplace-ready-spaces"
        icon={MapPinned}
        title={t('workplace.home.availability.title')}
        description={t('workplace.home.availability.description')}
        action={
          state === 'READY' && hasScope ? (
            <ActionButton component={Link} to={model.discoveryPath} intent="quiet" size="small">
              {t('workplace.home.findSpace')}
            </ActionButton>
          ) : undefined
        }
      />
      <Divider />
      {state !== 'READY' ? (
        <Box sx={{ px: 2.5, py: 3 }}>
          <Typography fontWeight={750}>
            {t(
              state === 'STALE'
                ? 'workplace.home.availability.staleTitle'
                : 'workplace.home.availability.unavailableTitle'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(
              state === 'STALE'
                ? 'workplace.home.availability.staleDescription'
                : 'workplace.home.availability.unavailableDescription'
            )}
          </Typography>
          <ActionButton intent="secondary" loading={refreshing} onClick={onRefresh} sx={{ mt: 2 }}>
            {t('workplace.home.nextAction.verify')}
          </ActionButton>
        </Box>
      ) : !hasScope ? (
        <Box sx={{ px: 2.5, py: 3 }}>
          <Typography fontWeight={750}>
            {t(`workplace.home.availability.${scopeKey}Title`)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(`workplace.home.availability.${scopeKey}Description`)}
          </Typography>
          {canManage && model.nextAction.kind !== model.scopeState && (
            <ActionButton
              component={Link}
              to="/workplace/admin/locations"
              intent="secondary"
              sx={{ mt: 2 }}
            >
              {t(
                model.scopeState === 'NO_FLOOR'
                  ? 'workplace.home.availability.configureFloor'
                  : model.scopeState === 'NO_RESOURCE'
                    ? 'workplace.home.availability.configureResources'
                    : 'workplace.home.availability.configureSite'
              )}
            </ActionButton>
          )}
        </Box>
      ) : model.availability.length ? (
        <Stack component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {model.availability.map((item, index) => {
            const Icon = RESOURCE_ICONS[item.type];
            const percent = item.total ? Math.round((item.available / item.total) * 100) : 0;
            return (
              <Box
                component="li"
                key={item.type}
                sx={{ borderTop: index ? 1 : 0, borderColor: 'divider' }}
              >
                <ButtonBase
                  component={Link}
                  to={model.discoveryPaths[item.type] ?? model.discoveryPath}
                  aria-label={t('workplace.home.availability.openType', {
                    type: t(`workplace.resourceTypes.${item.type}`),
                    available: item.available,
                    bookable: item.bookable,
                  })}
                  sx={{
                    width: 1,
                    display: 'grid',
                    gridTemplateColumns: '36px minmax(0, 1fr) auto',
                    gap: 1.25,
                    alignItems: 'center',
                    px: 2.25,
                    py: 1.35,
                    color: 'text.primary',
                    textAlign: 'left',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={(theme) => ({
                      width: 36,
                      height: 36,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1,
                      color: 'success.dark',
                      bgcolor: alpha(
                        theme.palette.success.main,
                        theme.palette.mode === 'dark' ? 0.2 : 0.1
                      ),
                    })}
                  >
                    <Icon size={17} />
                  </Box>
                  <Box minWidth={0}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" fontWeight={750}>
                        {t(`workplace.resourceTypes.${item.type}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {item.available}/{item.total}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        mt: 0.75,
                        height: 5,
                        bgcolor: 'action.hover',
                        overflow: 'hidden',
                        borderRadius: 0.5,
                      }}
                    >
                      <Box sx={{ width: `${percent}%`, height: 1, bgcolor: 'success.main' }} />
                    </Box>
                    {item.accessible > 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {t('workplace.home.availability.accessible', { count: item.accessible })}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.35 }}
                    >
                      {t('workplace.home.availability.bookableCount', {
                        count: item.bookable,
                      })}
                    </Typography>
                  </Box>
                  <ArrowRight size={15} aria-hidden="true" />
                </ButtonBase>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Box sx={{ px: 2.5, py: 3 }}>
          <Typography fontWeight={750}>{t('workplace.home.availability.emptyTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('workplace.home.availability.emptyDescription')}
          </Typography>
        </Box>
      )}
    </SectionShell>
  );
}

export function WorkplaceWeekRhythm({
  week,
  complete,
}: {
  week: readonly WorkplaceHomeWeekDay[];
  complete: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <SectionShell labelledBy="workplace-week-rhythm">
      <SectionHeader
        id="workplace-week-rhythm"
        icon={CalendarClock}
        title={t('workplace.home.week.title')}
        description={t('workplace.home.week.description')}
        action={
          <Stack direction="row" spacing={1.25} alignItems="center" color="text.secondary">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 8, height: 8, bgcolor: 'primary.main' }} />
              <Typography variant="caption">{t('workplace.home.week.meetings')}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 8, height: 8, bgcolor: 'success.main' }} />
              <Typography variant="caption">{t('workplace.home.week.focus')}</Typography>
            </Stack>
          </Stack>
        }
      />
      <Divider />
      {!complete && (
        <Typography
          color="warning.main"
          variant="caption"
          sx={{ display: 'block', px: 2, pt: 1.5 }}
        >
          {t('workplace.home.week.partial')}
        </Typography>
      )}
      <Box
        component="ol"
        sx={{
          p: 0,
          m: 0,
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
          },
        }}
      >
        {week.map((day, index) => (
          <Box
            component="li"
            key={day.date}
            sx={(theme) => ({
              minWidth: 0,
              px: 1.75,
              py: 1.7,
              borderTop: {
                xs: index ? 1 : 0,
                sm: index > 1 ? 1 : 0,
                lg: 0,
              },
              borderLeft: {
                xs: 0,
                sm: index % 2 ? 1 : 0,
                lg: index ? 1 : 0,
              },
              borderColor: 'divider',
              bgcolor: day.current
                ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.055)
                : 'transparent',
            })}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight={day.current ? 850 : 700}>
                {formatDate(
                  `${day.date}T00:00:00Z`,
                  { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' },
                  locale
                )}
              </Typography>
              {day.current && <Chip size="small" label={t('workplace.home.week.today')} />}
            </Stack>
            <Box sx={{ mt: 1.15 }}>
              <WorkplaceHomeWorkloadBar
                day={day}
                label={t('workplace.home.week.workloadLabel', {
                  meetingMinutes: day.meetingMinutes,
                  focusMinutes: day.focusMinutes,
                })}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.85 }}
            >
              {day.reservationCount
                ? t('workplace.home.week.reservations', { count: day.reservationCount })
                : t(
                    complete
                      ? 'workplace.home.week.noReservation'
                      : 'workplace.home.week.unverified'
                  )}
            </Typography>
            {day.locations.length > 0 && (
              <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mt: 0.25 }}>
                {day.locations.join(' · ')}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </SectionShell>
  );
}

function attentionCopy(item: WorkplaceHomeAttention, t: ReturnType<typeof useTranslation>['t']) {
  if (item.kind === 'CALENDAR') return { title: item.title, description: item.description };
  if (item.kind === 'ROOM_NEEDED') {
    return {
      title: t('workplace.home.attention.roomNeededTitle', { event: item.event.title }),
      description: t('workplace.home.attention.roomNeededDescription'),
    };
  }
  if (item.kind === 'CHECK_IN') {
    return {
      title: t('workplace.home.attention.checkInTitle', { resource: item.booking.resourceName }),
      description: t('workplace.home.attention.checkInDescription'),
    };
  }
  return {
    title: t('workplace.home.attention.releaseTitle', { resource: item.booking.resourceName }),
    description: t('workplace.home.attention.releaseDescription'),
  };
}

export function WorkplaceAttentionSection({
  items,
  complete,
}: {
  items: readonly WorkplaceHomeAttention[];
  complete: boolean;
}) {
  const { t } = useTranslation('rooms');
  return (
    <SectionShell labelledBy="workplace-attention">
      <SectionHeader
        id="workplace-attention"
        icon={ShieldCheck}
        title={t('workplace.home.attention.title')}
        description={t('workplace.home.attention.description')}
      />
      <Divider />
      {!complete && (
        <Typography
          color="warning.main"
          variant="caption"
          sx={{ display: 'block', px: 2.25, pt: 1.5 }}
        >
          {t('workplace.home.attention.partial')}
        </Typography>
      )}
      {items.length ? (
        <Stack component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {items.map((item, index) => {
            const copy = attentionCopy(item, t);
            const tone =
              item.severity === 'HIGH'
                ? 'error.main'
                : item.severity === 'MEDIUM'
                  ? 'warning.main'
                  : 'primary.main';
            return (
              <Box
                component="li"
                key={item.key}
                sx={{ borderTop: index ? 1 : 0, borderColor: 'divider' }}
              >
                <ButtonBase
                  component={Link}
                  to={item.path}
                  sx={{
                    width: 1,
                    display: 'grid',
                    gridTemplateColumns: '22px minmax(0, 1fr) auto',
                    gap: 1,
                    alignItems: 'start',
                    px: 2.25,
                    py: 1.45,
                    color: 'text.primary',
                    textAlign: 'left',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Box aria-hidden="true" sx={{ mt: '2px', color: tone, lineHeight: 0 }}>
                    <AlertCircle size={16} />
                  </Box>
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={750}>
                      {copy.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {copy.description}
                    </Typography>
                  </Box>
                  <ArrowRight size={15} aria-hidden="true" />
                </ButtonBase>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Stack direction="row" spacing={1.1} alignItems="flex-start" sx={{ px: 2.5, py: 3 }}>
          <CheckCircle2
            size={19}
            color="currentColor"
            style={{ color: 'var(--dwp-product-accent)' }}
            aria-hidden="true"
          />
          <Box>
            <Typography fontWeight={750}>
              {t(
                complete
                  ? 'workplace.home.attention.emptyTitle'
                  : 'workplace.home.attention.unavailableTitle'
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {t(
                complete
                  ? 'workplace.home.attention.emptyDescription'
                  : 'workplace.home.attention.unavailableDescription'
              )}
            </Typography>
          </Box>
        </Stack>
      )}
    </SectionShell>
  );
}
