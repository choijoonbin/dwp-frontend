import { useTranslation } from 'react-i18next';
import { CalendarDays, CalendarPlus, Layers3, List as ListIcon } from 'lucide-react';

import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

import type { CalendarScheduleView } from './calendar-schedule-state';

export function CalendarMobileNavigation({
  view,
  canCreate,
  onSelectView,
  onOpenSources,
  onCreate,
}: {
  view: CalendarScheduleView;
  canCreate: boolean;
  onSelectView: (view: 'day' | 'agenda') => void;
  onOpenSources: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('calendar');
  return (
    <Box
      component="nav"
      aria-label={t('schedule.mobileNavigation')}
      data-testid="calendar-mobile-navigation"
      sx={(theme) => ({
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.appBar,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        backdropFilter: 'blur(12px)',
        pb: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.08)',
        '@media (forced-colors: active)': {
          borderColor: 'CanvasText',
          backgroundColor: 'Canvas',
          backdropFilter: 'none',
          boxShadow: 'none',
        },
      })}
    >
      <BottomNavigation
        showLabels
        value={view === 'day' || view === 'agenda' ? view : false}
        onChange={(_, next: 'day' | 'agenda' | 'sources' | 'create') => {
          if (next === 'sources') onOpenSources();
          else if (next === 'create') onCreate();
          else onSelectView(next);
        }}
        sx={{ bgcolor: 'transparent', height: 58 }}
      >
        <BottomNavigationAction
          value="day"
          label={t('schedule.views.day')}
          icon={<CalendarDays size={19} />}
        />
        <BottomNavigationAction
          value="agenda"
          label={t('schedule.views.agenda')}
          icon={<ListIcon size={19} />}
        />
        <BottomNavigationAction
          value="sources"
          label={t('sources.title')}
          icon={<Layers3 size={19} />}
        />
        <BottomNavigationAction
          value="create"
          label={t('actions.newEvent')}
          icon={<CalendarPlus size={19} />}
          disabled={!canCreate}
        />
      </BottomNavigation>
    </Box>
  );
}
