import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  CalendarDays,
  Check,
  Clock3,
  Focus,
  ListTodo,
  MapPin,
  Pencil,
  Repeat2,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CalendarEvent, CalendarEventType } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

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
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" color="primary.main">
            {eyebrow}
          </Typography>
        )}
        <Typography component="h1" variant="h4" fontWeight={800} sx={{ mt: eyebrow ? 0.25 : 0 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
          {description}
        </Typography>
      </Box>
      {actions && (
        <Stack direction="row" spacing={1}>
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
  color,
  progress,
}: {
  label: string;
  value: string | number;
  hint: string;
  color: string;
  progress?: number;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        py: 1.75,
        px: 2,
        borderLeft: '3px solid',
        borderLeftColor: color,
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography variant="h5" component="p" fontWeight={800} sx={{ mt: 0.35 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {hint}
      </Typography>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, progress)}
          sx={{
            mt: 1,
            height: 4,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: color },
          }}
        />
      )}
    </Box>
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
        bgcolor: selected ? tone.soft : 'transparent',
        color: 'text.primary',
      }}
    >
      <Box
        component={onOpen ? 'button' : 'div'}
        type={onOpen ? 'button' : undefined}
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
        }}
      >
        <Box>
          <Typography variant="body2" fontWeight={800} sx={{ color: tone.main }}>
            {calendarTime(event.startsAt, language)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('units.minutes', { count: calendarDuration(event) })}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Avatar sx={{ width: 26, height: 26, bgcolor: tone.soft, color: tone.main }}>
              <Icon size={14} aria-hidden="true" />
            </Avatar>
            <Typography fontWeight={750} noWrap>
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
            label={t('event.accept')}
            intent="primary"
            size="small"
            onClick={() => onRespond('ACCEPTED')}
          >
            <Check size={16} />
          </ActionIconButton>
          <ActionIconButton
            label={t('event.decline')}
            intent="default"
            size="small"
            onClick={() => onRespond('DECLINED')}
          >
            <X size={16} />
          </ActionIconButton>
        </Stack>
      ) : onOpen ? (
        <ActionButton intent="quiet" size="small" onClick={onOpen} sx={{ minWidth: 0, mr: 1.5 }}>
          {t('actions.details')}
        </ActionButton>
      ) : null}
    </Box>
  );
}

export function CalendarEventDrawer({
  event,
  open,
  canEdit,
  onClose,
  onEdit,
  onCancel,
  onRespond,
}: {
  event: CalendarEvent | null;
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onRespond?: (response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  if (!event) return null;
  const tone = CALENDAR_EVENT_TONES[event.type];
  const Icon = tone.icon;
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: 1, sm: 440 }, maxWidth: '100%' } } }}
    >
      <Box sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2.5, bgcolor: tone.soft, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Chip
              icon={<Icon size={15} />}
              label={t(`event.types.${event.type}`)}
              sx={{ color: tone.main, bgcolor: 'background.paper', fontWeight: 750 }}
            />
            <Stack direction="row" spacing={0.5}>
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
          <Typography component="h2" variant="h5" fontWeight={800} sx={{ mt: 2 }}>
            {event.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {event.calendarName}
          </Typography>
        </Box>
        <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={2.5}>
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
            <Box>
              <Typography variant="overline" color="text.secondary">
                {t('event.organizer')}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: tone.main, fontSize: 13 }}>
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
            {event.attendees.length > 0 && (
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t('event.attendeeCount', { count: event.attendees.length })}
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.75 }}>
                  {event.attendees.slice(0, 8).map((attendee) => (
                    <Stack key={attendee.email} direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>
                        {attendee.name.slice(0, 1)}
                      </Avatar>
                      <Typography variant="body2" sx={{ flex: 1 }} noWrap>
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
          {event.myResponse === 'NEEDS_ACTION' && onRespond ? (
            <Stack direction="row" spacing={1}>
              <ActionButton fullWidth intent="primary" onClick={() => onRespond('ACCEPTED')}>
                {t('event.accept')}
              </ActionButton>
              <ActionButton fullWidth intent="secondary" onClick={() => onRespond('TENTATIVE')}>
                {t('event.tentative')}
              </ActionButton>
              <ActionButton intent="quiet" onClick={() => onRespond('DECLINED')}>
                {t('event.decline')}
              </ActionButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1}>
              {canEdit && onCancel && (
                <ActionButton intent="danger" onClick={onCancel}>
                  {t('event.cancelEvent')}
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
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
