import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, House, Library, ListTodo, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';

import type { MeetingsView } from './meetings-navigation';

const MOBILE_DESTINATIONS = [
  { view: 'home', path: '/meetings/home', icon: House },
  { view: 'mine', path: '/meetings/mine', icon: CalendarClock },
  { view: 'history', path: '/meetings/history', icon: Library },
  { view: 'follow-ups', path: '/meetings/follow-ups', icon: ListTodo },
  { view: 'preferences', path: '/meetings/preferences', icon: SlidersHorizontal },
] as const satisfies ReadonlyArray<{
  view: MeetingsView;
  path: string;
  icon: typeof House;
}>;

type MobileDestination = (typeof MOBILE_DESTINATIONS)[number]['view'];

const MOBILE_NAVIGATION_MIN_HEIGHT = 'max(64px, calc(2rem + 32px))';
const MOBILE_NAVIGATION_CONTENT_CLEARANCE = `calc(${MOBILE_NAVIGATION_MIN_HEIGHT} + env(safe-area-inset-bottom) + 24px)`;

export function meetingMobileNavigationVisible(view: MeetingsView, search: string): boolean {
  if (!MOBILE_DESTINATIONS.some((item) => item.view === view)) return false;
  if (view !== 'mine') return true;
  const contextualView = new URLSearchParams(search).get('view');
  return contextualView === null || contextualView === '';
}

export function MeetingMobileNavigation({
  activeView,
  children,
}: {
  activeView: MobileDestination;
  children: ReactNode;
}) {
  const { t } = useTranslation('meetings');
  return (
    <>
      <Box
        data-testid="meeting-mobile-navigation-content"
        sx={{
          minWidth: 0,
          pb: { xs: MOBILE_NAVIGATION_CONTENT_CLEARANCE, sm: 0 },
        }}
      >
        {children}
      </Box>
      <Box
        component="nav"
        aria-label={t('mobileNavigation.label')}
        data-testid="meeting-mobile-navigation"
        sx={(theme) => ({
          display: { xs: 'grid', sm: 'none' },
          position: 'fixed',
          zIndex: theme.zIndex.appBar,
          right: 0,
          bottom: 0,
          left: 0,
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          minHeight: `calc(${MOBILE_NAVIGATION_MIN_HEIGHT} + env(safe-area-inset-bottom))`,
          px: 0,
          pb: 'env(safe-area-inset-bottom)',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: 'none',
          '@media print': { display: 'none' },
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText',
            boxShadow: 'none',
          },
        })}
      >
        {MOBILE_DESTINATIONS.map(({ view, path, icon: Icon }) => {
          const active = activeView === view;
          const accessibleLabel = t(`navigation.items.meetings.${view}.label`);
          return (
            <Box
              key={view}
              component={Link}
              to={path}
              aria-label={accessibleLabel}
              aria-current={active ? 'page' : undefined}
              data-testid={`meeting-mobile-navigation-${view}`}
              sx={(theme) => ({
                display: 'flex',
                minWidth: 0,
                minHeight: MOBILE_NAVIGATION_MIN_HEIGHT,
                px: 0,
                pt: 0.75,
                pb: 0.5,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 0.35,
                color: active ? 'primary.main' : 'text.secondary',
                textDecoration: 'none',
                borderRadius: 'var(--dwp-shape-borderRadius)',
                '&:focus-visible': {
                  outline: `3px solid ${theme.palette.primary.main}`,
                  outlineOffset: -3,
                },
                '&:hover': { bgcolor: 'action.hover', color: 'primary.main' },
              })}
            >
              <Icon size={19} strokeWidth={active ? 2.25 : 1.8} aria-hidden="true" />
              <Box
                component="span"
                sx={(theme) => ({
                  maxWidth: '100%',
                  fontSize: theme.typography.caption.fontSize,
                  fontWeight: active
                    ? theme.typography.fontWeightBold
                    : theme.typography.fontWeightMedium,
                  lineHeight: theme.typography.caption.lineHeight,
                  textAlign: 'center',
                  overflowWrap: 'anywhere',
                  whiteSpace: 'normal',
                })}
              >
                {t(`mobileNavigation.items.${view}`)}
              </Box>
            </Box>
          );
        })}
      </Box>
    </>
  );
}
