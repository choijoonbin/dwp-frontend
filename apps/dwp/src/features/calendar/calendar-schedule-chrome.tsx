import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  CalendarPlus,
  Command,
  Focus,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { GovernedSavedViewControl } from '../../components/governed-saved-view-control';
import { CalendarPageHeading } from './calendar-components';
import type { CalendarScheduleView } from './calendar-schedule-state';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;

export function CalendarScheduleChrome({
  canCreate,
  sourcesAvailable,
  commandPaletteOpen,
  desktopSources,
  sourcesCollapsed,
  hasExplicitScheduleState,
  view,
  savedViewConfiguration,
  onOpenCommands,
  onCreate,
  onToggleSources,
  onOpenSources,
  onApplySavedView,
}: {
  canCreate: boolean;
  sourcesAvailable: boolean;
  commandPaletteOpen: boolean;
  desktopSources: boolean;
  sourcesCollapsed: boolean;
  hasExplicitScheduleState: boolean;
  view: CalendarScheduleView;
  savedViewConfiguration: Record<string, unknown>;
  onOpenCommands: () => void;
  onCreate: (type: 'MEETING' | 'FOCUS') => void;
  onToggleSources: () => void;
  onOpenSources: () => void;
  onApplySavedView: (configuration: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation('calendar');
  const commandShortcut =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.userAgent)
      ? '⌘/'
      : 'Ctrl+/';
  const sourceControl = desktopSources ? (
    <ActionButton
      intent="quiet"
      startIcon={sourcesCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
      aria-controls={sourcesAvailable ? 'calendar-source-panel' : undefined}
      aria-expanded={sourcesAvailable ? !sourcesCollapsed : undefined}
      disabled={!sourcesAvailable}
      onClick={onToggleSources}
    >
      {t(sourcesCollapsed ? 'sources.showPanel' : 'sources.hidePanel')}
    </ActionButton>
  ) : (
    <ActionButton intent="secondary" startIcon={<Layers3 size={17} />} onClick={onOpenSources}>
      {t('sources.openPicker')}
    </ActionButton>
  );
  const commandControl = (
    <ActionButton
      intent="secondary"
      startIcon={<Command size={17} />}
      endIcon={
        <Box
          component="kbd"
          sx={{
            px: 0.65,
            py: 0.1,
            border: 1,
            borderColor: 'divider',
            borderRadius: COMPACT_RADIUS,
            color: 'text.secondary',
            fontFamily: 'inherit',
            typography: 'caption',
          }}
        >
          {commandShortcut}
        </Box>
      }
      aria-haspopup="dialog"
      aria-expanded={commandPaletteOpen}
      onClick={onOpenCommands}
    >
      {t('command.trigger')}
    </ActionButton>
  );
  const createControl = canCreate ? (
    <ActionButton
      intent="primary"
      startIcon={<CalendarPlus size={18} />}
      onClick={() => onCreate('MEETING')}
    >
      {t('actions.newEvent')}
    </ActionButton>
  ) : null;

  return (
    <>
      <CalendarPageHeading
        icon={CalendarDays}
        eyebrow={t('schedule.eyebrow')}
        title={t('schedule.title')}
        description={t('schedule.description')}
        actions={
          <>
            {commandControl}
            {createControl}
          </>
        }
      />

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        justifyContent="flex-end"
        sx={{ mb: 1.5 }}
      >
        {sourceControl}
        <GovernedSavedViewControl
          surfaceKey="calendar.schedule"
          currentConfiguration={savedViewConfiguration}
          selectedBuiltInViewId={hasExplicitScheduleState ? null : `builtin-${view}`}
          builtInViews={(['week', 'month', 'agenda'] as const).map((savedView) => ({
            id: `builtin-${savedView}`,
            name: t(`schedule.views.${savedView}`),
            configuration: { view: savedView },
            isDefault: savedView === 'week',
          }))}
          onApply={onApplySavedView}
        />
        {canCreate && (
          <ActionButton
            intent="secondary"
            startIcon={<Focus size={17} />}
            onClick={() => onCreate('FOCUS')}
          >
            {t('actions.addFocus')}
          </ActionButton>
        )}
      </Stack>
    </>
  );
}
