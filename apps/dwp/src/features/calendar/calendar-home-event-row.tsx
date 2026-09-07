import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Video, X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { calendarTime } from './calendar-components';
import { CALENDAR_HOME_ROW_RADIUS } from './calendar-home-surfaces';
import { calendarConferenceUrl } from './calendar-today-model';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

export function CalendarHomeEventRow({
  event,
  language,
  current,
  onOpen,
  onRespond,
}: {
  event: CalendarEvent;
  language: string;
  current: boolean;
  onOpen: () => void;
  onRespond?: (response: 'ACCEPTED' | 'DECLINED') => void;
}) {
  const { t } = useTranslation('calendar');
  const focus = event.type === 'FOCUS';
  return (
    <Box
      component="article"
      sx={(theme) => ({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        border: '1px solid',
        borderColor: alpha(
          focus ? theme.palette.success.main : theme.palette.primary.main,
          current ? 0.45 : 0.18
        ),
        borderRadius: CALENDAR_HOME_ROW_RADIUS,
        bgcolor: alpha(focus ? theme.palette.success.main : theme.palette.primary.main, 0.035),
        overflow: 'hidden',
        borderInlineStartWidth: current ? 3 : 1,
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: current ? 'Highlight' : 'CanvasText',
          boxShadow: 'none',
        },
      })}
    >
      <Box
        component="button"
        type="button"
        onClick={onOpen}
        aria-label={t('event.openDetailsFor', { title: event.title })}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '86px minmax(0, 1fr) auto' },
          alignItems: 'center',
          gap: 1.5,
          flex: '1 1 16rem',
          width: 1,
          minWidth: 0,
          p: 1.5,
          textAlign: 'left',
          color: 'text.primary',
          bgcolor: 'transparent',
          border: 0,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
          '@media (forced-colors: active)': { '&:focus-visible': { outlineColor: 'Highlight' } },
        }}
      >
        <Box
          sx={(theme) => ({
            p: 1,
            borderRadius: CALENDAR_HOME_ROW_RADIUS,
            bgcolor: alpha(theme.palette.primary.main, 0.07),
            color: 'primary.main',
            '@media (forced-colors: active)': {
              border: '1px solid CanvasText',
              color: 'CanvasText',
            },
          })}
        >
          <Typography
            component="span"
            variant="caption"
            fontWeight="fontWeightBold"
            sx={{ display: 'block' }}
          >
            {calendarTime(event.startsAt, language)}
          </Typography>
          <Typography component="span" variant="caption" color="text.secondary">
            –{calendarTime(event.endsAt, language)}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="span"
            variant="subtitle2"
            fontWeight="fontWeightBold"
            sx={{ display: 'block', overflowWrap: 'anywhere' }}
          >
            {event.title}
          </Typography>
          <Stack
            component="span"
            direction="row"
            gap={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 0.75 }}
          >
            {calendarConferenceUrl(event) ? <Video size={14} aria-hidden="true" /> : null}
            <Typography component="span" variant="caption" color="text.secondary">
              {event.location || event.calendarName}
            </Typography>
            {event.attendees.length > 0 ? (
              <Box
                component="span"
                aria-label={t('home.attendeeShort', { count: event.attendees.length })}
                sx={{ display: 'inline-flex', pl: 0.5 }}
              >
                {event.attendees.slice(0, 3).map((person, index) => (
                  <Box
                    component="span"
                    key={`${person.email}-${index}`}
                    title={person.name}
                    sx={(theme) => ({
                      width: 23,
                      height: 23,
                      ml: -0.5,
                      display: 'inline-grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: 'background.paper',
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      typography: 'caption',
                      '@media (forced-colors: active)': {
                        color: 'CanvasText',
                        borderColor: 'CanvasText',
                      },
                    })}
                  >
                    {person.name.slice(0, 1)}
                  </Box>
                ))}
                {event.attendees.length > 3 ? (
                  <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                    +{event.attendees.length - 3}
                  </Typography>
                ) : null}
              </Box>
            ) : null}
            {event.conflict ? (
              <Typography component="span" variant="caption" color="error.main">
                {t('event.conflict')}
              </Typography>
            ) : null}
          </Stack>
        </Box>
        <ChevronRight size={16} aria-hidden="true" />
      </Box>
      {event.myResponse === 'NEEDS_ACTION' && onRespond ? (
        <Stack direction="row" sx={{ p: 1 }}>
          <ActionIconButton
            label={t('event.acceptFor', { title: event.title })}
            onClick={() => onRespond('ACCEPTED')}
          >
            <Check size={16} />
          </ActionIconButton>
          <ActionIconButton
            label={t('event.declineFor', { title: event.title })}
            onClick={() => onRespond('DECLINED')}
          >
            <X size={16} />
          </ActionIconButton>
        </Stack>
      ) : null}
    </Box>
  );
}
