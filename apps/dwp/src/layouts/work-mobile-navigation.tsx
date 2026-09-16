import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarDays, House, Inbox, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

const stitchTabs = [
  { key: 'home', path: '/', routePrefix: '/', icon: House },
  { key: 'work', path: '/work/queue', routePrefix: '/work', icon: Inbox },
  {
    key: 'calendar',
    path: '/calendar/home',
    routePrefix: '/calendar',
    resourceKey: 'APP.CALENDAR',
    icon: CalendarDays,
  },
  {
    key: 'notifications',
    path: '/notifications/home',
    routePrefix: '/notifications',
    resourceKey: 'APP.NOTIFICATIONS',
    icon: Bell,
  },
  { key: 'profile', path: '/account/profile', routePrefix: '/account', icon: UserRound },
] as const;

function isActiveTab(pathname: string, tab: (typeof stitchTabs)[number]) {
  return tab.key === 'home' ? pathname === '/' : pathname.startsWith(tab.routePrefix);
}

export function WorkMobileNavigation({ availableWidth }: { availableWidth?: number } = {}) {
  const { t } = useTranslation('work');
  const { permissions } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const mediaMobile = useMediaQuery('(max-width:899.95px)');
  const mobile = availableWidth === undefined ? mediaMobile : availableWidth < 900;
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editing = document.activeElement?.matches(
        'textarea, input:not([type="checkbox"]):not([type="radio"]), [contenteditable="true"]'
      );
      setKeyboardOpen(Boolean(editing && viewport && window.innerHeight - viewport.height > 120));
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  if (!mobile) return null;
  const tabStyles = {
    minWidth: 0,
    minHeight: 60,
    px: 0.25,
    py: 0.75,
    gap: 0.5,
    flexDirection: 'column',
    color: 'text.secondary',
    borderRadius: 0,
    '& .MuiTypography-root': { maxWidth: '100%', overflowWrap: 'anywhere', textAlign: 'center' },
    '&[aria-current="page"]': { color: 'primary.main', bgcolor: 'action.selected' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -3 },
    '@media (forced-colors: active)': {
      '&[aria-current="page"]': { outline: '2px solid Highlight', outlineOffset: -2 },
    },
  } as const;

  return (
    <Box
      component="nav"
      data-testid="work-mobile-bottom-navigation"
      data-shell-auxiliary-layer="true"
      aria-label={t('workHub.mobileNavigation.label')}
      sx={{
        position: 'fixed',
        bottom: 0,
        insetInline: 0,
        display: keyboardOpen ? 'none' : 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom, 0px)',
        zIndex: (theme) => theme.zIndex.appBar + 1,
      }}
    >
      {stitchTabs.map((tab) => {
        const active = isActiveTab(location.pathname, tab);
        const available =
          !('resourceKey' in tab) || isAppReadEntitled(tab.resourceKey, permissions);
        const Icon = tab.icon;
        return (
          <ActionButton
            key={tab.key}
            intent="quiet"
            disabled={!available}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (!active) navigate(tab.path);
            }}
            sx={tabStyles}
          >
            <Icon size={19} aria-hidden="true" />
            <Typography component="span" variant="caption">
              {t(`workHub.mobileNavigation.${tab.key}`)}
            </Typography>
          </ActionButton>
        );
      })}
    </Box>
  );
}
