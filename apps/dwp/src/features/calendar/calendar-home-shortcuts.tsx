import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Keyboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionButton, foundationTokens, SectionHeader } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { calendarInternalPath } from './calendar-schedule-state';
import { calendarHomeSurface, CALENDAR_HOME_ROW_RADIUS } from './calendar-home-surfaces';

export function CalendarHomeShortcuts({
  currentSearch,
  onOpenCommands,
}: {
  currentSearch: string;
  onOpenCommands?: () => void;
}) {
  const { t } = useTranslation('calendar');
  return (
    <Box
      component="section"
      aria-labelledby="calendar-home-shortcuts-title"
      data-testid="calendar-home-shortcuts"
      sx={[
        calendarHomeSurface,
        {
          p: 2,
          minWidth: 0,
          overflowWrap: 'anywhere',
        },
      ]}
    >
      <SectionHeader
        id="calendar-home-shortcuts-title"
        icon={Keyboard}
        title={t('workspace.shortcuts.title')}
      />
      <Stack spacing={0.5} sx={{ mt: 1.25 }}>
        {onOpenCommands ? (
          <ActionButton
            intent="quiet"
            onClick={onOpenCommands}
            aria-haspopup="dialog"
            aria-keyshortcuts="Meta+/ Control+/"
            aria-label={t('command.trigger')}
            sx={{
              minWidth: 0,
              minHeight: 44,
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
              textAlign: 'start',
              whiteSpace: 'normal',
            }}
          >
            {t('command.trigger')}
            <Box
              component="kbd"
              aria-hidden="true"
              sx={{
                px: 0.75,
                py: 0.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: CALENDAR_HOME_ROW_RADIUS,
                fontFamily: foundationTokens.font.mono,
                typography: 'caption',
                whiteSpace: 'nowrap',
                '@media (forced-colors: active)': { borderColor: 'CanvasText' },
              }}
            >
              {t('workspace.shortcuts.commandKeys')}
            </Box>
          </ActionButton>
        ) : null}
        {[
          ['command.items.open-schedule', '/calendar/schedule'],
          ['command.items.find-time', '/calendar/availability'],
        ].map(([label, path]) => (
          <ActionButton
            key={path}
            component={Link}
            to={calendarInternalPath(path!, new URLSearchParams(currentSearch), {
              preserveScheduleState: path === '/calendar/schedule',
            })}
            intent="quiet"
            endIcon={<ArrowUpRight size={15} aria-hidden="true" />}
            sx={{
              minWidth: 0,
              minHeight: 44,
              justifyContent: 'space-between',
              textAlign: 'start',
              whiteSpace: 'normal',
            }}
          >
            {t(label!)}
          </ActionButton>
        ))}
      </Stack>
    </Box>
  );
}
