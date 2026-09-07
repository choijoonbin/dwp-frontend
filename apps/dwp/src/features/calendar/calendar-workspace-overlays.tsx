import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';

import type { CalendarEventType, CalendarHome } from '@dwp-frontend/shared-utils';
import type { CalendarReadSourceState } from './calendar-read-source-state';

const CalendarCommandPalette = lazy(async () => ({
  default: (await import('./calendar-command-palette')).CalendarCommandPalette,
}));
const CalendarWorkspaceRail = lazy(async () => ({
  default: (await import('./calendar-workspace-rail')).CalendarWorkspaceRail,
}));

type RailProps = Readonly<{
  data: CalendarHome | undefined;
  state: CalendarReadSourceState;
  isFetching: boolean;
  language: string;
  currentSearch: string;
  roomsPath?: string | null;
  onRetry: () => void;
  canCreate?: boolean;
  onCreateFocus?: () => void;
  onOpenCommands?: () => void;
}>;

function RailFallback() {
  const { t } = useTranslation('calendar');
  return (
    <LoadingState
      label={t('schedule.loading')}
      variant="skeleton"
      embedded
      skeletonHeights={[96, 152, 192]}
      skeletonPadding={2}
    />
  );
}

export function CalendarWorkspaceRailSurface({
  visible,
  label,
  expanded = false,
  ...railProps
}: RailProps & { visible: boolean; label: string; expanded?: boolean }) {
  if (!visible) return null;
  return (
    <Box
      id="calendar-workspace-rail"
      component="aside"
      aria-label={label}
      sx={{
        minWidth: 0,
        overflow: 'hidden',
        position: expanded ? 'static' : 'sticky',
        top: 1.5,
        maxHeight: expanded ? 'none' : 'calc(100dvh - 17rem)',
        '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      }}
    >
      <Suspense fallback={<RailFallback />}>
        <CalendarWorkspaceRail {...railProps} />
      </Suspense>
    </Box>
  );
}

export function CalendarCommandPaletteOverlay({
  open,
  canCreate,
  onClose,
  onCreate,
  onNavigate,
}: {
  open: boolean;
  canCreate: boolean;
  onClose: () => void;
  onCreate: (type: CalendarEventType) => void;
  onNavigate: (path: string) => void;
}) {
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CalendarCommandPalette
        open
        canCreate={canCreate}
        onClose={onClose}
        onCreate={onCreate}
        onNavigate={onNavigate}
      />
    </Suspense>
  );
}

export function CalendarWorkspaceOverlays({
  workspace,
  desktopRail,
  railOpen,
  railLabel,
  commandOpen,
  canCreate,
  rail,
  onCloseRail,
  onCloseCommand,
  onCreate,
  onNavigate,
}: {
  workspace: boolean;
  desktopRail: boolean;
  railOpen: boolean;
  railLabel: string;
  commandOpen: boolean;
  canCreate: boolean;
  rail: RailProps;
  onCloseRail: () => void;
  onCloseCommand: () => void;
  onCreate: (type: CalendarEventType) => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <>
      <Drawer
        open={workspace && !desktopRail && railOpen}
        anchor="right"
        onClose={onCloseRail}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-label': railLabel,
            sx: { width: 'min(380px, 100vw)', maxWidth: '100vw', height: '100dvh' },
          },
        }}
      >
        <Suspense fallback={<RailFallback />}>
          <CalendarWorkspaceRail {...rail} onClose={onCloseRail} />
        </Suspense>
      </Drawer>

      <CalendarCommandPaletteOverlay
        open={commandOpen}
        canCreate={canCreate}
        onClose={onCloseCommand}
        onCreate={onCreate}
        onNavigate={onNavigate}
      />
    </>
  );
}
