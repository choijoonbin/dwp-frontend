import { foundationTokens } from '@dwp-frontend/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Armchair,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Focus,
  LogIn,
  MapPin,
  MapPinned,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  WorkplaceHomeSectionHeader as SectionHeader,
  WorkplaceHomeSectionShell as SectionShell,
} from './workplace-home-section-frame';
import { workplaceDecisionActionProps } from './workplace-decision-status';
import { workplaceCheckInClock } from './workplace-check-in-clock';
import { useWorkplaceDecisionClock } from './workplace-decision-clock';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type {
  WorkplaceHomeAgendaItem,
  WorkplaceHomeAttention,
  WorkplaceHomeModel,
} from './workplace-home-model';
import type { LucideIcon } from 'lucide-react';

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
      eyebrow: t('workplace.home.nextAction.reservedSpace'),
      title: action.booking.resourceName,
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

export function WorkplaceDayBrief({
  model,
  timeZone,
  nowInstant,
  availabilityState,
  checkInState,
  decisionComplete,
  canManage,
  canViewAccess,
  checkInBusy,
  decisionActionId,
  onRefresh,
  onCheckIn,
}: {
  model: WorkplaceHomeModel;
  timeZone: string;
  nowInstant: number;
  availabilityState: 'READY' | 'STALE' | 'UNAVAILABLE';
  checkInState: 'AVAILABLE' | 'READ_ONLY' | 'UNVERIFIED';
  decisionComplete: boolean;
  canManage: boolean;
  canViewAccess: boolean;
  checkInBusy: boolean;
  decisionActionId: string | null;
  onRefresh: () => void;
  onCheckIn: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const deadline =
    model.nextAction.kind === 'CHECK_IN' ? model.nextAction.booking.checkInClosesAt : null;
  const clockKey =
    model.nextAction.kind === 'CHECK_IN'
      ? `${model.nextAction.booking.bookingId}:${model.nextAction.booking.version}:${deadline}`
      : 'no-check-in';
  const { nowInstant: clockNow, advance: advanceClock } = useWorkplaceDecisionClock(clockKey, [
    new Date(nowInstant).toISOString(),
  ]);
  useEffect(() => {
    if (!deadline || !Number.isFinite(Date.parse(deadline))) return;
    advanceClock();
    const timer = window.setInterval(advanceClock, 1000);
    return () => window.clearInterval(timer);
  }, [advanceClock, deadline]);
  const countdown = workplaceCheckInClock(deadline, clockNow);
  const setupAction = ['NO_SITE', 'NO_FLOOR', 'NO_RESOURCE'].includes(model.nextAction.kind);
  const setupActionLabel =
    model.nextAction.kind === 'NO_FLOOR'
      ? t('workplace.home.availability.configureFloor')
      : model.nextAction.kind === 'NO_RESOURCE'
        ? t('workplace.home.availability.configureResources')
        : t('workplace.home.availability.configureSite');
  const needsDecisionRefresh =
    (model.nextAction.kind !== 'CHECK_IN' && !decisionComplete) ||
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
        ...workplaceMemberCard(theme),
        mt: foundationTokens.workplace.layout.gutter + 'px',
        display: 'grid',
        p: { xs: 2, md: foundationTokens.workplace.layout.gutter + 'px' },
        gap: { xs: 2, md: foundationTokens.workplace.layout.gutter + 'px' },
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 2fr)' },
        alignItems: 'stretch',
      })}
    >
      <Box
        sx={{
          minWidth: 0,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Stack direction="row" gap={0.75} alignItems="center" color="primary.main">
          <CalendarClock size={16} />
          <Typography variant="overline">{t('workplace.home.eyebrow')}</Typography>
        </Stack>
        <Typography
          component="h2"
          sx={{ ...foundationTokens.workplace.typography.sectionTitle, mt: 0.5 }}
        >
          {t('workplace.home.welcomeTitle')}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ ...foundationTokens.workplace.typography.body, mt: 0.75 }}
        >
          {t('workplace.home.welcomeDescription')}
        </Typography>
        <Stack direction="row" gap={0.75} alignItems="flex-start" sx={{ mt: 1.5 }}>
          <MapPin size={15} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {[model.selectedSiteName, model.selectedFloorName].filter(Boolean).join(' · ') ||
              t('workplace.home.availability.noScope')}{' '}
            · {t('workplace.home.availability.nextHour')}
          </Typography>
        </Stack>
      </Box>
      <Box
        data-testid="workplace-day-context"
        sx={(theme) => ({
          p: { xs: 0, md: 2 },
          minWidth: 0,
          bgcolor: {
            xs: 'transparent',
            md: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.055),
          },
          borderRadius: foundationTokens.radius.surface + 'px',
        })}
      >
        <Stack
          direction="row"
          gap={0.75}
          alignItems="center"
          color={checkInAction ? 'error.main' : 'primary.main'}
        >
          {checkInAction ? <LogIn size={16} /> : <CalendarClock size={16} />}
          <Typography variant="overline">{copy.eyebrow}</Typography>
        </Stack>
        <Typography
          id="workplace-day-brief"
          component="h2"
          sx={{
            mt: 0.5,
            ...foundationTokens.workplace.typography.sectionTitle,
          }}
        >
          {copy.title}
        </Typography>
        {checkInAction && countdown && (
          <Stack
            direction="row"
            gap={1}
            alignItems="baseline"
            justifyContent="space-between"
            sx={{ mt: 0.75 }}
          >
            <Typography color="text.secondary" sx={foundationTokens.workplace.typography.smallBody}>
              {t(
                countdown.elapsed
                  ? 'workplace.home.nextAction.deadlineElapsed'
                  : 'workplace.home.nextAction.remainingTime'
              )}
            </Typography>
            <Typography
              component="span"
              data-testid="workplace-home-check-in-countdown"
              color="error.main"
              sx={{
                ...foundationTokens.workplace.typography.metric,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {countdown.remaining}
            </Typography>
          </Stack>
        )}
        <Typography
          color="text.secondary"
          sx={{ ...foundationTokens.workplace.typography.body, mt: 0.65 }}
        >
          {model.nextAction.kind === 'CHECK_IN'
            ? t('workplace.home.nextAction.usageTime', {
                from: formatDate(
                  model.nextAction.booking.startsAt,
                  { timeStyle: 'short', hourCycle: 'h23', timeZone },
                  locale
                ),
                to: formatDate(
                  model.nextAction.booking.endsAt,
                  { timeStyle: 'short', hourCycle: 'h23', timeZone },
                  locale
                ),
              })
            : copy.description}
        </Typography>
        {(copy.time || copy.location) && (
          <Stack direction="row" gap={1.5} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
            {copy.time && (
              <Stack direction="row" gap={0.5} alignItems="center">
                <Clock3 size={14} aria-hidden="true" />
                <Typography variant="caption" fontWeight="fontWeightBold">
                  {checkInAction
                    ? t('workplace.member.bookings.checkInDeadline', {
                        time: formatDate(
                          copy.time,
                          { timeStyle: 'short', hourCycle: 'h23', timeZone },
                          locale
                        ),
                      })
                    : formatDate(
                        copy.time,
                        { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone },
                        locale
                      )}
                </Typography>
              </Stack>
            )}
            {copy.location && (
              <Typography variant="caption" color="text.secondary">
                {copy.location}
              </Typography>
            )}
          </Stack>
        )}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ mt: 1.5, '& > .MuiButton-root': { width: { xs: '100%', md: 'auto' } } }}
        >
          {checkInAction && checkInState === 'AVAILABLE' && !countdown?.elapsed ? (
            <ActionButton
              intent="primary"
              startIcon={<LogIn size={16} />}
              loading={checkInBusy}
              onClick={onCheckIn}
              {...(decisionActionId ? workplaceDecisionActionProps(decisionActionId) : {})}
            >
              {t('workplace.home.nextAction.checkIn')}
            </ActionButton>
          ) : checkInAction && (checkInState === 'UNVERIFIED' || countdown?.elapsed) ? (
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
            model.nextAction.kind === 'NO_SITE' && canViewAccess ? (
              <Box data-testid="workplace-home-access-help">
                <ActionButton
                  component={Link}
                  to="/workplace/admin/governance?area=access"
                  intent="primary"
                  endIcon={<ArrowRight size={16} />}
                >
                  {t('workplace.admin.governance.tabs.access')}
                </ActionButton>
              </Box>
            ) : canManage ? (
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
          {!['BOOK_SPACE', 'BROWSE_SPACE', 'NONE'].includes(model.nextAction.kind) &&
            !(checkInAction && checkInState === 'READ_ONLY' && !countdown?.elapsed) &&
            !setupAction && (
              <ActionButton
                component={Link}
                to={
                  model.nextAction.kind === 'CHECK_IN'
                    ? model.nextAction.path
                    : '/workplace/my-bookings'
                }
                intent="secondary"
              >
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
    </Box>
  );
}

export function WorkplaceTodayFlow({
  agenda,
  complete,
  timeZone,
}: {
  agenda: readonly WorkplaceHomeAgendaItem[];
  complete: boolean;
  timeZone?: string;
}) {
  const { t, i18n } = useTranslation('rooms');
  const [expanded, setExpanded] = useState(false);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <SectionShell labelledBy="workplace-today-flow">
      <SectionHeader
        id="workplace-today-flow"
        icon={CalendarDays}
        title={t('workplace.home.agenda.title')}
        description={t('workplace.home.agenda.description')}
        action={
          <Typography sx={foundationTokens.workplace.typography.caption} color="text.secondary">
            {t('workplace.home.agenda.count', { count: agenda.length })}
          </Typography>
        }
      />
      <Divider sx={{ display: { xs: 'none', md: 'block' } }} />
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
        <Box
          component="ol"
          sx={{
            p: 0,
            m: 0,
            listStyle: 'none',
            bgcolor: { xs: 'background.paper', md: 'transparent' },
            borderRadius: foundationTokens.workplace.radius.card + 'px',
            overflow: 'hidden',
          }}
        >
          {agenda.slice(0, expanded ? agenda.length : 6).map((item) => {
            const Icon = AGENDA_ICONS[item.kind];
            return (
              <Box
                component="li"
                key={item.key}
                sx={(theme) => ({
                  ...workplaceMemberSoftSurface(theme),
                  bgcolor: { xs: 'transparent', md: workplaceMemberSoftSurface(theme).bgcolor },
                  mx: { xs: 0, md: 1.5 },
                  my: { xs: 0, md: 1 },
                })}
              >
                <ButtonBase
                  component={Link}
                  to={item.path}
                  sx={{
                    width: 1,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '50px minmax(0, 1fr) 16px',
                      sm: '70px 26px minmax(0, 1fr) auto',
                    },
                    gap: { xs: 0.75, sm: 1 },
                    alignItems: 'center',
                    px: { xs: 2, md: 2.5 },
                    py: 1.25,
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
                    sx={{
                      pr: 1,
                      borderRight: 3,
                      borderColor:
                        item.kind === 'WORKSPACE'
                          ? 'primary.main'
                          : item.kind === 'FOCUS'
                            ? 'primary.light'
                            : 'secondary.main',
                    }}
                  >
                    <Typography
                      component="div"
                      sx={foundationTokens.workplace.typography.caption}
                      fontWeight="fontWeightBold"
                    >
                      {formatDate(
                        item.startsAt,
                        { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone },
                        locale
                      )}
                    </Typography>
                    <Typography
                      component="div"
                      sx={foundationTokens.workplace.typography.caption}
                      color="text.secondary"
                    >
                      {formatDate(
                        item.endsAt,
                        { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone },
                        locale
                      )}
                    </Typography>
                  </Box>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 22,
                      height: 22,
                      display: { xs: 'none', sm: 'grid' },
                      placeItems: 'center',
                      color: 'text.secondary',
                    }}
                  >
                    <Icon size={15} />
                  </Box>
                  <Box minWidth={0}>
                    <Typography
                      component="span"
                      sx={{
                        ...foundationTokens.workplace.typography.caption,
                        display: 'inline-block',
                        bgcolor: 'var(--dwp-product-soft)',
                        color: 'primary.main',
                        px: 0.5,
                        mr: 0.75,
                      }}
                    >
                      {t(`workplace.home.agenda.kinds.${item.kind}`)}
                    </Typography>
                    <Typography
                      component="span"
                      variant="body2"
                      fontWeight="fontWeightBold"
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
          <Typography fontWeight="fontWeightBold">
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
      {agenda.length > 6 ? (
        <ActionButton
          intent="quiet"
          size="small"
          fullWidth
          onClick={() => setExpanded((value) => !value)}
        >
          {t(expanded ? 'workplace.home.attention.showLess' : 'workplace.home.attention.showAll', {
            count: agenda.length,
          })}
        </ActionButton>
      ) : null}
    </SectionShell>
  );
}

export { WorkplaceReadySpaces } from './workplace-home-ready-spaces';

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
  timeZone,
}: {
  items: readonly WorkplaceHomeAttention[];
  complete: boolean;
  timeZone?: string;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const [expanded, setExpanded] = useState(false);
  return (
    <SectionShell labelledBy="workplace-attention" mobileSurface="attention">
      <SectionHeader
        id="workplace-attention"
        icon={ShieldCheck}
        title={t('workplace.home.attention.title')}
        description={t('workplace.home.attention.description')}
        mobileIcon
        action={
          <Typography
            component="span"
            sx={{
              ...foundationTokens.workplace.typography.caption,
              bgcolor: 'background.paper',
              px: 1,
              py: 0.25,
              borderRadius: foundationTokens.workplace.radius.badge + 'px',
            }}
          >
            {t('workplace.home.attention.count', { count: items.length })}
          </Typography>
        }
      />
      <Divider sx={{ display: { xs: 'none', md: 'block' } }} />
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
        <Stack component="ul" sx={{ p: 0, m: 0, listStyle: 'none', gap: { xs: 1, md: 0 } }}>
          {items.slice(0, expanded ? items.length : 5).map((item, index) => {
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
                sx={{
                  borderTop: { xs: 0, md: index ? 1 : 0 },
                  borderColor: 'divider',
                  bgcolor: { xs: 'background.paper', md: 'transparent' },
                  borderRadius: { xs: foundationTokens.workplace.radius.card + 'px', md: 0 },
                }}
              >
                <ButtonBase
                  component={Link}
                  to={item.path}
                  {...(['CHECK_IN', 'RELEASE'].includes(item.kind)
                    ? workplaceDecisionActionProps(item.key)
                    : {})}
                  sx={{
                    width: 1,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'auto minmax(0, 1fr) auto',
                      md: '22px minmax(0, 1fr) auto',
                    },
                    gap: 1,
                    alignItems: 'start',
                    px: { xs: 1.25, md: 2.25 },
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
                  <Typography
                    component="span"
                    sx={{
                      ...foundationTokens.workplace.typography.caption,
                      display: { xs: 'inline-block', md: 'none' },
                      bgcolor: 'var(--dwp-product-soft)',
                      color: tone,
                      px: 0.5,
                      py: 0.25,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(`workplace.home.attention.kinds.${item.kind}`)}
                  </Typography>
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: { xs: 'none', md: 'block' },
                      mt: '2px',
                      color: tone,
                      lineHeight: 0,
                    }}
                  >
                    <AlertCircle size={16} />
                  </Box>
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {item.kind === 'CHECK_IN' || item.kind === 'RELEASE'
                        ? item.booking.resourceName
                        : item.kind === 'ROOM_NEEDED'
                          ? item.event.title
                          : copy.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.kind === 'CHECK_IN' && item.booking.checkInClosesAt
                        ? t('workplace.home.attention.deadline', {
                            time: formatDate(
                              item.booking.checkInClosesAt,
                              { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone },
                              locale
                            ),
                          })
                        : copy.description}
                    </Typography>
                  </Box>
                  <Typography
                    component="span"
                    sx={{
                      ...foundationTokens.workplace.typography.caption,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      px: 1,
                      py: 1,
                      borderRadius: foundationTokens.workplace.radius.control + 'px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(`workplace.home.attention.actions.${item.kind}`)}
                  </Typography>
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
            <Typography fontWeight="fontWeightBold">
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
      {items.length > 5 ? (
        <ActionButton
          intent="quiet"
          size="small"
          fullWidth
          onClick={() => setExpanded((value) => !value)}
        >
          {t(expanded ? 'workplace.home.attention.showLess' : 'workplace.home.attention.showAll', {
            count: items.length,
          })}
        </ActionButton>
      ) : null}
    </SectionShell>
  );
}
