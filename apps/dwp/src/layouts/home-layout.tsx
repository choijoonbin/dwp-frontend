import { useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import {
  AppWindow,
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CalendarClock,
  ContactRound,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  MonitorCog,
  FileCheck2,
  Home,
  Layers3,
  MessagesSquare,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import type { HomeExperienceVariant } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { BrandLockup } from '../components/brand-lockup';
import { DesktopNavigationHeader } from '../components/desktop-navigation-header';
import { HOME_LIGHT_CANVAS, HOME_LIGHT_SURFACE } from '../components/home-surface-tokens';
import { ShellHeader } from '../components/shell-header';
import { useLargeTextReflow } from '../components/use-large-text-reflow';
import { shellRegistry } from '../features/shell/shell-registry';
import {
  ShellMobileNavigationDrawer,
  useShellMobileNavigation,
} from '../features/shell/shell-mobile-navigation';

import type { LucideIcon } from 'lucide-react';

type HomeExperienceMode = HomeExperienceVariant;

type HomeNavigationItem = {
  key:
    | 'home'
    | 'work'
    | 'approvals'
    | 'communications'
    | 'calendar'
    | 'spaces'
    | 'apps'
    | 'classicOverview'
    | 'classicDesks'
    | 'classicRooms'
    | 'classicDirectory'
    | 'classicTelemetry'
    | 'flowToday'
    | 'flowSchedule'
    | 'flowSpaces'
    | 'flowTasks'
    | 'flowTelemetry';
  route: string;
  icon: LucideIcon;
  resourceKey?: string;
};

const HOME_MOBILE_BOTTOM_NAVIGATION_MAX_WIDTH = 600;

const HOME_NAVIGATION: readonly HomeNavigationItem[] = [
  { key: 'home', route: '/', icon: Home },
  { key: 'work', route: '/work', icon: BriefcaseBusiness, resourceKey: 'APP.WORK' },
  { key: 'approvals', route: '/approvals', icon: FileCheck2, resourceKey: 'APP.APPROVALS' },
  {
    key: 'communications',
    route: '/communications',
    icon: MessagesSquare,
    resourceKey: 'APP.COMMUNICATIONS',
  },
  { key: 'calendar', route: '/calendar', icon: CalendarDays, resourceKey: 'APP.CALENDAR' },
  { key: 'spaces', route: '/spaces', icon: Layers3, resourceKey: 'APP.SPACES' },
  { key: 'apps', route: '/apps', icon: AppWindow },
];

const CLASSIC_HOME_MOBILE_NAVIGATION: readonly HomeNavigationItem[] = [
  { key: 'classicOverview', route: '/', icon: LayoutDashboard },
  {
    key: 'classicDesks',
    route: '/workplace/explore?type=DESK',
    icon: MapPinned,
    resourceKey: 'APP.WORKPLACE',
  },
  {
    key: 'classicRooms',
    route: '/workplace/rooms',
    icon: CalendarClock,
    resourceKey: 'APP.WORKPLACE',
  },
  { key: 'classicDirectory', route: '/hr', icon: ContactRound, resourceKey: 'APP.HCM' },
  { key: 'classicTelemetry', route: '/activity', icon: MonitorCog, resourceKey: 'APP.ACTIVITY' },
];

const FLOW_HOME_MOBILE_NAVIGATION: readonly HomeNavigationItem[] = [
  { key: 'flowToday', route: '/', icon: Home },
  { key: 'flowSchedule', route: '/calendar', icon: CalendarDays, resourceKey: 'APP.CALENDAR' },
  { key: 'flowSpaces', route: '/spaces', icon: Layers3, resourceKey: 'APP.SPACES' },
  { key: 'flowTasks', route: '/work', icon: ListChecks, resourceKey: 'APP.WORK' },
  { key: 'flowTelemetry', route: '/activity', icon: Activity, resourceKey: 'APP.ACTIVITY' },
];

function currentViewportWidth(): number {
  if (typeof window === 'undefined') return 1440;
  return document.documentElement.clientWidth || window.innerWidth;
}

function HomeNavigationList({
  compact,
  items,
  onNavigate,
}: {
  compact: boolean;
  items: readonly HomeNavigationItem[];
  onNavigate?: () => void;
}) {
  const { t } = useTranslation('shell');

  return (
    <Box
      component="nav"
      aria-label={t('navigation.label')}
      sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: compact ? 1 : 1.5, py: 2 }}
    >
      <Stack component="ul" gap={0.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {items.map(({ key, route, icon: Icon }) => {
          const label = t(`navigation.items.${key}`);
          return (
            <Box component="li" key={key}>
              <Tooltip title={compact ? label : ''} placement="right">
                <ActionButton
                  intent="quiet"
                  component={NavLink}
                  to={route}
                  fullWidth
                  data-testid={`home-navigation-item-${key}`}
                  aria-label={compact ? label : undefined}
                  onClick={onNavigate}
                  sx={{
                    minWidth: 0,
                    minHeight: 44,
                    gap: 1.25,
                    px: compact ? 0 : 1.25,
                    justifyContent: compact ? 'center' : 'flex-start',
                    color: 'text.secondary',
                    '&[aria-current="page"]': {
                      color: 'primary.main',
                      bgcolor: 'action.selected',
                    },
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                    '@media (forced-colors: active)': {
                      '&[aria-current="page"]': {
                        color: 'Highlight',
                        outline: '2px solid Highlight',
                        outlineOffset: -2,
                      },
                    },
                  }}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  {!compact && (
                    <Typography component="span" variant="body2" sx={{ minWidth: 0 }}>
                      {label}
                    </Typography>
                  )}
                </ActionButton>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

export function HomeLayout() {
  const { t } = useTranslation('shell');
  const { hasPermission } = usePermissions();
  const [viewportWidth, setViewportWidth] = useState(currentViewportWidth);
  const largeText = useLargeTextReflow();
  useLayoutEffect(() => {
    const syncViewportWidth = () => setViewportWidth(currentViewportWidth());
    syncViewportWidth();
    window.addEventListener('resize', syncViewportWidth);
    window.visualViewport?.addEventListener('resize', syncViewportWidth);
    return () => {
      window.removeEventListener('resize', syncViewportWidth);
      window.visualViewport?.removeEventListener('resize', syncViewportWidth);
    };
  }, []);
  const bottomNavigationVisible = viewportWidth <= HOME_MOBILE_BOTTOM_NAVIGATION_MAX_WIDTH;
  const drawerNavigationVisible = !bottomNavigationVisible;
  const mobileNavigation = useShellMobileNavigation({ headerTestId: 'home-header' });
  const shell = shellRegistry.home;
  const [mode, setMode] = useState<HomeExperienceMode>('CLASSIC');
  const navigationItems = useMemo(
    () =>
      HOME_NAVIGATION.filter(
        ({ resourceKey }) => !resourceKey || hasPermission(resourceKey, 'VIEW')
      ),
    [hasPermission]
  );
  const mobileNavigationItems = useMemo(
    () =>
      (mode === 'CLASSIC' ? CLASSIC_HOME_MOBILE_NAVIGATION : FLOW_HOME_MOBILE_NAVIGATION).filter(
        ({ resourceKey }) => !resourceKey || hasPermission(resourceKey, 'VIEW')
      ),
    [hasPermission, mode]
  );

  return (
    <Box
      data-testid="personal-home-shell"
      data-home-experience-mode={mode}
      data-home-large-text={largeText ? 'true' : 'false'}
      data-home-navigation-pattern={bottomNavigationVisible ? 'bottom' : 'drawer'}
      sx={{
        '--home-canvas': (theme) =>
          theme.palette.mode === 'dark' ? theme.palette.background.default : HOME_LIGHT_CANVAS,
        '--home-surface': (theme) =>
          theme.palette.mode === 'dark' ? theme.palette.background.paper : HOME_LIGHT_SURFACE,
        '--home-surface-subtle': (theme) =>
          theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : foundationTokens.color.neutral[25],
        '--home-radius-section': '16px',
        '--home-radius-item': '12px',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        width: 1,
        minWidth: 0,
        overflowX: 'clip',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'background.default' : HOME_LIGHT_CANVAS,
        fontFamily: foundationTokens.font.ui,
        '& .MuiTypography-root, & .MuiButtonBase-root, & .MuiChip-root': {
          fontFamily: 'inherit',
        },
        '&:has([data-workspace-composer-placement="floating"]) [data-testid="home-mobile-bottom-navigation"]':
          { display: 'none' },
        '&:has([data-workspace-composer-placement="floating"]) [data-testid="personal-home-main"]':
          {
            paddingBottom: 'calc(128px + env(safe-area-inset-bottom, 0px))',
          },
        '&[data-home-large-text="true"] [data-launchpad-group-target]': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) !important',
          gridAutoRows: 'minmax(180px, auto) !important',
          height: 'auto !important',
          maxHeight: 'none !important',
          overflow: 'visible !important',
        },
        '&[data-home-large-text="true"] [data-launchpad-item-label]': {
          height: 'auto !important',
          minHeight: '3.6em',
          display: 'block',
          overflow: 'visible',
          WebkitLineClamp: 'unset',
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
          overflowWrap: 'anywhere',
        },
        '&[data-home-large-text="true"] [data-testid="classic-home"] [data-launchpad-group-grid] > section [data-launchpad-group-target]':
          {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) !important',
          },
        '&[data-home-large-text="true"] [data-launchpad-label-short]': { display: 'none' },
        '&[data-home-large-text="true"] [data-launchpad-label-full]': {
          display: 'inline',
        },
        '@media (max-width: 600px)': {
          '&[data-home-large-text="true"] [data-launchpad-group-target]': {
            gridTemplateColumns: 'minmax(0, 1fr) !important',
          },
          '&[data-home-large-text="true"] [data-testid="classic-home"] [data-launchpad-group-grid] > section [data-launchpad-group-target]':
            {
              gridTemplateColumns: 'minmax(0, 1fr) !important',
            },
        },
        '@media (prefers-reduced-motion: reduce)': {
          scrollBehavior: 'auto',
          '& *, & *::before, & *::after': {
            animationDuration: '0ms !important',
            animationIterationCount: foundationTokens.home.motion.reducedIterationCount,
            transitionDuration: '0ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      }}
    >
      <ShellMobileNavigationDrawer
        controlsId="home-mobile-navigation"
        label={t('navigation.label')}
        onDismiss={mobileNavigation.dismiss}
        open={drawerNavigationVisible && mobileNavigation.open}
        testId="home-mobile-navigation"
        width={280}
      >
        <Stack sx={{ height: 1, minHeight: 0, bgcolor: 'background.paper' }}>
          <DesktopNavigationHeader
            compact={false}
            collapsible={false}
            controlsId="home-mobile-navigation"
            label={mode === 'CLASSIC' ? 'Classic' : mode === 'FLOW_V1' ? 'Flow' : 'MZ / AI Stage'}
            onDismiss={mobileNavigation.dismiss}
            onToggle={() => undefined}
          />
          <Divider />
          <HomeNavigationList
            compact={false}
            items={navigationItems}
            onNavigate={mobileNavigation.navigate}
          />
        </Stack>
      </ShellMobileNavigationDrawer>
      <ShellHeader
        testId="home-header"
        shellKey={shell.key}
        scope={shell.scope}
        position={shell.headerPosition}
        surface={shell.headerSurface}
        showWorkspace={shell.showWorkspace}
        compactSearch
        maxContentWidth={2560}
        desktopOffset={0}
        navigation={
          drawerNavigationVisible
            ? {
                controlsId: 'home-mobile-navigation',
                expanded: mobileNavigation.open,
                label: t('navigation.open'),
                showOnDesktop: true,
                testId: 'home-mobile-navigation-trigger',
                onOpen: mobileNavigation.openFrom,
              }
            : undefined
        }
        sx={{
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'background.paper' : HOME_LIGHT_SURFACE,
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          '& .MuiToolbar-root': { minHeight: '63px !important', px: { xs: 2, md: '24px' } },
        }}
        brand={
          <>
            <BrandLockup
              variant="condensed"
              sx={{ display: { xs: 'inline-flex', sm: 'none' }, flexShrink: 0 }}
            />
            <BrandLockup
              variant="full"
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}
            />
          </>
        }
      />

      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        data-testid="personal-home-main"
        data-home-layout-owner="home-layout"
        data-home-width-contract="available-inline-size"
        sx={{
          width: 1,
          ml: 0,
          maxWidth: '100%',
          minWidth: 0,
          minHeight: 0,
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'clip',
          pb: bottomNavigationVisible ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0,
          containerType: 'inline-size',
          containerName: 'dwp-home-workspace',
          outline: 'none',
        }}
      >
        <Outlet context={setMode} />
      </Box>
      {bottomNavigationVisible && (
        <Box
          component="nav"
          aria-label={t('navigation.label')}
          data-testid="home-mobile-bottom-navigation"
          sx={{
            position: 'fixed',
            inset: 'auto 0 0 0',
            zIndex: (theme) => theme.zIndex.appBar,
            minHeight: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            pb: 'env(safe-area-inset-bottom, 0px)',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'background.paper' : HOME_LIGHT_SURFACE,
            borderTop: 1,
            borderColor: 'divider',
            '@media (forced-colors: active)': {
              bgcolor: 'Canvas',
              borderColor: 'CanvasText',
            },
          }}
        >
          <Stack component="ul" direction="row" sx={{ height: 64, m: 0, p: 0, listStyle: 'none' }}>
            {mobileNavigationItems.map(({ key, route, icon: Icon }) => {
              const label = t(`navigation.items.${key}`);
              return (
                <Box component="li" key={key} sx={{ flex: '1 1 0', minWidth: 0 }}>
                  <ActionButton
                    intent="quiet"
                    component={NavLink}
                    to={route}
                    fullWidth
                    data-testid={`home-mobile-navigation-item-${key}`}
                    data-home-mobile-navigation-mode={mode}
                    aria-label={label}
                    sx={{
                      minWidth: 44,
                      width: 1,
                      height: 64,
                      px: 0.5,
                      gap: 0.25,
                      flexDirection: 'column',
                      justifyContent: 'center',
                      color: 'text.secondary',
                      '&[aria-current="page"]': {
                        color: 'primary.main',
                        bgcolor: 'action.selected',
                      },
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -3,
                      },
                      '@media (forced-colors: active)': {
                        '&[aria-current="page"]': { color: 'Highlight' },
                      },
                    }}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <Typography
                      component="span"
                      variant="caption"
                      noWrap
                      sx={{
                        maxWidth: 1,
                        fontSize: foundationTokens.home.typography.captionSize,
                        lineHeight: foundationTokens.home.typography.navigationLineHeight,
                      }}
                    >
                      {label}
                    </Typography>
                  </ActionButton>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
