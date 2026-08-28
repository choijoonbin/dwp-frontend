import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Focus,
  ListTodo,
  MapPin,
  Pencil,
  Repeat2,
  Star,
  Trash2,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, lighten } from '@mui/material/styles';

import type { CalendarEvent, CalendarEventType } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

import { CalendarSignal, type CalendarExperienceTone } from './calendar-experience';

export const CALENDAR_EVENT_TONES: Record<
  CalendarEventType,
  { main: string; soft: string; icon: LucideIcon }
> = {
  MEETING: { main: '#2563EB', soft: '#EAF1FF', icon: UsersRound },
  FOCUS: { main: '#0F766E', soft: '#E6F4F1', icon: Focus },
  TASK: { main: '#A16207', soft: '#FFF4D6', icon: ListTodo },
  OUT_OF_OFFICE: { main: '#9333EA', soft: '#F4EAFE', icon: CalendarClock },
  REMINDER: { main: '#475569', soft: '#EEF1F4', icon: Clock3 },
};

export function calendarTime(value: string, language: string) {
  return formatDate(
    value,
    {
      hour: '2-digit',
      minute: '2-digit',
    },
    resolveSupportedLocale(language)
  );
}

export function calendarDate(value: string | Date, language: string, includeWeekday = true) {
  return formatDate(
    value,
    {
      month: 'long',
      day: 'numeric',
      weekday: includeWeekday ? 'long' : undefined,
    },
    resolveSupportedLocale(language)
  );
}

export function calendarLocale(language: string) {
  return resolveSupportedLocale(language);
}

export function calendarDuration(event: Pick<CalendarEvent, 'startsAt' | 'endsAt'>) {
  return Math.max(
    0,
    Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000)
  );
}

export function CalendarPageHeading({
  eyebrow,
  title,
  description,
  actions,
  icon: HeadingIcon = CalendarDays,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Box
      component="header"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
        alignItems: { xs: 'stretch', md: 'center' },
        justifyContent: 'space-between',
        gap: { xs: 2, md: 3 },
        mb: { xs: 3, md: 3.5 },
        pb: { xs: 2.25, md: 2.75 },
        borderBottom: 1,
        borderColor: (theme) => alpha(theme.palette.divider, 0.72),
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: 1.4, sm: 1.75 }}
        alignItems="flex-start"
        sx={{ minWidth: 0 }}
      >
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            width: { xs: 40, sm: 44 },
            height: { xs: 40, sm: 44 },
            flex: { xs: '0 0 40px', sm: '0 0 44px' },
            mt: 0.2,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.09),
            '@media (forced-colors: active)': {
              border: '1px solid CanvasText',
              backgroundColor: 'Canvas',
              color: 'CanvasText',
            },
          })}
        >
          <HeadingIcon size={21} strokeWidth={1.9} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {eyebrow && (
            <Typography
              variant="caption"
              color="primary.main"
              fontWeight={600}
              sx={{ display: 'block', mb: 0.35, letterSpacing: '0.025em' }}
            >
              {eyebrow}
            </Typography>
          )}
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '1.65rem', sm: '1.9rem' },
              lineHeight: 1.18,
              fontWeight: 700,
              letterSpacing: '-0.035em',
            }}
          >
            {title}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{
              mt: 0.6,
              maxWidth: 780,
              fontSize: { xs: '0.875rem', sm: '0.925rem' },
              lineHeight: 1.6,
            }}
          >
            {description}
          </Typography>
        </Box>
      </Stack>
      {actions && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            width: { xs: 1, md: 'auto' },
            flexWrap: 'wrap',
            '& > *': {
              minWidth: 0,
              maxWidth: '100%',
              flex: { xs: '1 1 9rem', sm: '0 0 auto' },
            },
          }}
        >
          {actions}
        </Stack>
      )}
    </Box>
  );
}

export function CalendarMetric({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  progress,
  progressLabel,
  selected,
  compact,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: CalendarExperienceTone;
  progress?: number;
  progressLabel?: string;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <CalendarSignal
      label={label}
      value={value}
      detail={hint}
      icon={icon}
      tone={tone}
      progress={progress}
      progressLabel={progressLabel}
      selected={selected}
      compact={compact}
      onClick={onClick}
      actionLabel={actionLabel}
    />
  );
}

export function CalendarAgendaItem({
  event,
  selected = false,
  onOpen,
  onRespond,
}: {
  event: CalendarEvent;
  selected?: boolean;
  onOpen?: () => void;
  onRespond?: (response: 'ACCEPTED' | 'DECLINED') => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  const tone = CALENDAR_EVENT_TONES[event.type];
  const Icon = tone.icon;
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <Box
      component="article"
      sx={{
        width: 1,
        minHeight: 72,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 1,
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: (theme) =>
          selected ? alpha(tone.main, theme.palette.mode === 'dark' ? 0.22 : 0.1) : 'transparent',
        color: 'text.primary',
        '@media (forced-colors: active)': {
          backgroundColor: 'Canvas',
          borderColor: 'CanvasText',
          outline: selected ? '2px solid Highlight' : 'none',
          outlineOffset: -2,
        },
      }}
    >
      <Box
        component={onOpen ? 'button' : 'div'}
        type={onOpen ? 'button' : undefined}
        aria-label={onOpen ? t('event.openDetailsFor', { title: event.title }) : undefined}
        onClick={onOpen}
        sx={{
          minWidth: 0,
          minHeight: 72,
          p: 1.5,
          display: 'grid',
          gridTemplateColumns: '52px minmax(0, 1fr)',
          gap: 1.5,
          alignItems: 'center',
          border: 0,
          bgcolor: 'transparent',
          color: 'text.primary',
          textAlign: 'left',
          cursor: onOpen ? 'pointer' : 'default',
          '&:hover': onOpen ? { bgcolor: 'action.hover' } : undefined,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
          '@media (forced-colors: active)': {
            '&:focus-visible': { outlineColor: 'Highlight' },
          },
        }}
      >
        <Box>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={(theme) => ({
              color: theme.palette.mode === 'dark' ? lighten(tone.main, 0.42) : tone.main,
              '@media (forced-colors: active)': { color: 'CanvasText' },
            })}
          >
            {calendarTime(event.startsAt, language)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('units.minutes', { count: calendarDuration(event) })}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Avatar
              sx={(theme) => ({
                width: 26,
                height: 26,
                bgcolor: alpha(tone.main, theme.palette.mode === 'dark' ? 0.25 : 0.12),
                color: theme.palette.mode === 'dark' ? lighten(tone.main, 0.48) : tone.main,
                '@media (forced-colors: active)': {
                  border: '1px solid CanvasText',
                  backgroundColor: 'Canvas',
                  color: 'CanvasText',
                },
              })}
            >
              <Icon size={14} aria-hidden="true" />
            </Avatar>
            <Typography fontWeight={600} noWrap>
              {event.title}
            </Typography>
            {event.recurrence !== 'NONE' && <Repeat2 size={14} color="currentColor" />}
            {event.conflict && (
              <Chip size="small" color="error" variant="outlined" label={t('event.conflict')} />
            )}
          </Stack>
          <Stack direction="row" spacing={1.25} sx={{ mt: 0.5 }} color="text.secondary">
            {event.location && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                <MapPin size={13} />
                <Typography variant="caption" noWrap>
                  {event.location}
                </Typography>
              </Stack>
            )}
            {event.conferenceUrl && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Video size={13} />
                <Typography variant="caption">{t('event.online')}</Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>
      {event.myResponse === 'NEEDS_ACTION' && onRespond ? (
        <Stack direction="row" spacing={0.5} sx={{ pr: 1.5 }}>
          <ActionIconButton
            label={t('event.acceptFor', { title: event.title })}
            intent="primary"
            size="small"
            onClick={() => onRespond('ACCEPTED')}
          >
            <Check size={16} />
          </ActionIconButton>
          <ActionIconButton
            label={t('event.declineFor', { title: event.title })}
            intent="default"
            size="small"
            onClick={() => onRespond('DECLINED')}
          >
            <X size={16} />
          </ActionIconButton>
        </Stack>
      ) : onOpen ? (
        <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', pr: 1.5 }}>
          <ChevronRight size={17} />
        </Box>
      ) : null}
    </Box>
  );
}

export function CalendarEventDrawer({
  event,
  open,
  canEdit,
  canDelete,
  canStar,
  starBusy = false,
  onClose,
  onEdit,
  onCancel,
  onTrash,
  onToggleStar,
  onRespond,
}: {
  event: CalendarEvent | null;
  open: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canStar: boolean;
  starBusy?: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onTrash?: () => void;
  onToggleStar?: () => void;
  onRespond?: (response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  if (!event) return null;
  const tone = CALENDAR_EVENT_TONES[event.type];
  const Icon = tone.icon;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const cancelForEveryone = event.type === 'MEETING' && event.attendees.length > 0;
  const destructiveAction = !canDelete
    ? null
    : cancelForEveryone && onCancel
      ? { label: t('event.cancelEvent'), onClick: onCancel, icon: null }
      : onTrash
        ? { label: t('event.moveToTrash'), onClick: onTrash, icon: <Trash2 size={16} /> }
        : onCancel
          ? { label: t('event.cancelEvent'), onClick: onCancel, icon: null }
          : null;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'calendar-event-drawer-title',
          sx: { width: { xs: 1, sm: 440 }, maxWidth: '100%' },
        },
      }}
    >
      <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={(theme) => ({
            p: 2.5,
            bgcolor: alpha(tone.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
            borderBottom: 1,
            borderColor: 'divider',
            '@media (forced-colors: active)': {
              backgroundColor: 'Canvas',
              borderColor: 'CanvasText',
            },
          })}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Chip
                icon={<Icon size={15} />}
                label={t(`event.types.${event.type}`)}
                sx={(theme) => ({
                  color: theme.palette.mode === 'dark' ? lighten(tone.main, 0.42) : tone.main,
                  bgcolor: 'background.paper',
                  fontWeight: 600,
                  '@media (forced-colors: active)': {
                    border: '1px solid CanvasText',
                    backgroundColor: 'Canvas',
                    color: 'CanvasText',
                  },
                })}
              />
              {event.importance && event.importance !== 'NORMAL' && (
                <Chip
                  size="small"
                  color={event.importance === 'HIGH' ? 'error' : 'default'}
                  label={t(`event.importance.${event.importance}`)}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={0.5}>
              {canStar && onToggleStar && (
                <ActionIconButton
                  label={t(event.starred ? 'event.unstar' : 'event.star')}
                  onClick={onToggleStar}
                  disabled={starBusy}
                >
                  <Star size={18} fill={event.starred ? 'currentColor' : 'none'} />
                </ActionIconButton>
              )}
              {canEdit && onEdit && (
                <ActionIconButton label={t('actions.edit')} onClick={onEdit}>
                  <Pencil size={18} />
                </ActionIconButton>
              )}
              <ActionIconButton label={t('actions.close')} onClick={onClose}>
                <X size={19} />
              </ActionIconButton>
            </Stack>
          </Stack>
          <Typography
            id="calendar-event-drawer-title"
            component="h2"
            variant="h5"
            fontWeight={700}
            sx={{ mt: 2 }}
          >
            {event.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {event.calendarName}
          </Typography>
        </Box>
        <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={2.5}>
            {event.restrictionReason && (
              <Alert severity="info" variant="outlined">
                {t(`event.restrictions.${event.restrictionReason}`, {
                  defaultValue: t('event.restrictionFallback'),
                })}
              </Alert>
            )}
            <Stack direction="row" spacing={1.5}>
              <CalendarDays size={19} />
              <Box>
                <Typography fontWeight={700}>{calendarDate(event.startsAt, language)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {calendarTime(event.startsAt, language)} – {calendarTime(event.endsAt, language)}
                  {' · '}
                  {t('units.minutes', { count: calendarDuration(event) })}
                </Typography>
              </Box>
            </Stack>
            {event.location && (
              <Stack direction="row" spacing={1.5}>
                <MapPin size={19} />
                <Box>
                  <Typography fontWeight={700}>{event.location}</Typography>
                  {event.resource && (
                    <Typography variant="body2" color="text.secondary">
                      {event.resource.site}
                      {event.resource.floor ? ` · ${event.resource.floor}` : ''}
                    </Typography>
                  )}
                </Box>
              </Stack>
            )}
            {event.description && (
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t(event.type === 'MEETING' ? 'event.agendaLabel' : 'event.descriptionLabel')}
                </Typography>
                <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {event.description}
                </Typography>
              </Box>
            )}
            <Divider />
            {event.organizerName && (
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t('event.organizer')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                  <Avatar
                    sx={(theme) => ({
                      width: 34,
                      height: 34,
                      bgcolor: tone.main,
                      color: theme.palette.getContrastText(tone.main),
                      fontSize: 13,
                    })}
                  >
                    {event.organizerName.slice(0, 1)}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={700}>{event.organizerName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {event.organizerEmail ?? t('event.internalOrganizer')}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
            {event.attendees.length > 0 && (
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t('event.attendeeCount', { count: event.attendees.length })}
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.75 }}>
                  {event.attendees.map((attendee) => (
                    <Stack key={attendee.email} direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>
                        {attendee.name.slice(0, 1)}
                      </Avatar>
                      <Typography variant="body2" sx={{ flex: 1 }} noWrap title={attendee.name}>
                        {attendee.name}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`event.responses.${attendee.response}`)}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack spacing={1.5}>
            {event.responseRequired && onRespond && (
              <Box component="section" aria-label={t('event.responseTitle')}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {t('event.responseTitle')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('event.responseDescription')}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`event.responses.${event.myResponse ?? 'NEEDS_ACTION'}`)}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {(['ACCEPTED', 'TENTATIVE', 'DECLINED'] as const).map((response) => {
                    const selected = event.myResponse === response;
                    return (
                      <ActionButton
                        key={response}
                        fullWidth
                        intent={selected ? 'primary' : 'secondary'}
                        aria-pressed={selected}
                        onClick={() => onRespond(response)}
                      >
                        {t(
                          response === 'ACCEPTED'
                            ? 'event.accept'
                            : response === 'TENTATIVE'
                              ? 'event.tentative'
                              : 'event.decline'
                        )}
                      </ActionButton>
                    );
                  })}
                </Stack>
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {destructiveAction && (
                <ActionButton
                  intent="danger"
                  startIcon={destructiveAction.icon}
                  onClick={destructiveAction.onClick}
                >
                  {destructiveAction.label}
                </ActionButton>
              )}
              {event.conferenceUrl ? (
                <ActionButton
                  fullWidth
                  intent="primary"
                  onClick={() => window.open(event.conferenceUrl!, '_blank', 'noopener,noreferrer')}
                  startIcon={<Video size={17} />}
                >
                  {t('event.join')}
                </ActionButton>
              ) : (
                <ActionButton fullWidth intent="secondary" onClick={onClose}>
                  {t('actions.close')}
                </ActionButton>
              )}
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}
