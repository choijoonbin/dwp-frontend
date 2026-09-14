import { useTranslation } from 'react-i18next';
import { Activity, History, Home, Inbox, Menu, MessageSquarePlus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  ProductAreaMobileShellContext,
  ProductAreaMobileShellPresentation,
} from '../../layouts/product-area-layout';
import { DwaionMobileHeader } from './dwaion-mobile-header';
import {
  resolveDwaionMobileHeaderProfile,
  type DwaionMobileDestination,
  type DwaionMobileHeaderProfile,
} from './dwaion-mobile-shell-profile';

const DESTINATIONS = {
  home: { path: '/dwaion/home', view: 'home', icon: Home },
  new: { path: '/dwaion/new', view: 'new', icon: MessageSquarePlus },
  conversations: { path: '/dwaion/conversations', view: 'conversations', icon: History },
  activity: { path: '/dwaion/activity', view: 'activity', icon: Activity },
  proposals: { path: '/dwaion/proposals', view: 'proposals', icon: Inbox },
} as const satisfies Record<
  DwaionMobileDestination,
  { path: string; view: string; icon: typeof Home }
>;

function DwaionMobileNavigation({
  context,
  profile,
}: {
  context: ProductAreaMobileShellContext;
  profile: DwaionMobileHeaderProfile;
}) {
  const { t } = useTranslation('work');
  const visibleNavigationPaths = new Set(context.visibleNavigationPaths);
  const destinations = profile.destinations
    .map((destination) => DESTINATIONS[destination])
    .filter(({ path }) => visibleNavigationPaths.has(path));

  return (
    <Box
      component="nav"
      aria-label={t('dwaionMobileNavigation.label')}
      data-testid="dwaion-mobile-navigation"
      sx={{
        position: 'fixed',
        inset: 'auto 0 0 0',
        zIndex: (theme) => theme.zIndex.appBar,
        height: 58,
        display: { xs: 'flex', lg: 'none' },
        alignItems: 'stretch',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        boxShadow: (theme) => `0 -4px 16px ${alpha(theme.palette.common.black, 0.05)}`,
        '@supports (padding-bottom: env(safe-area-inset-bottom))': {
          height: 'calc(58px + env(safe-area-inset-bottom))',
          pb: 'env(safe-area-inset-bottom)',
        },
      }}
    >
      {destinations.map(({ path, view, icon: Icon }) => {
        const selected =
          context.pathname === path ||
          (path === '/dwaion/conversations' &&
            context.pathname.startsWith('/dwaion/conversations/'));
        const label = t(`dwaionMobileNavigation.${view}`);
        return (
          <Box
            key={path}
            component={NavLink}
            to={path}
            aria-current={selected ? 'page' : undefined}
            sx={{
              flex: '1 1 0',
              minWidth: 0,
              minHeight: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.2,
              color: selected ? 'var(--dwp-product-accent)' : 'text.secondary',
              textDecoration: 'none',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            <Icon size={19} strokeWidth={selected ? 2.25 : 1.8} aria-hidden="true" />
            <Typography
              component="span"
              sx={{
                fontSize: 'overline.fontSize',
                lineHeight: 'button.lineHeight',
                fontWeight: selected ? 'fontWeightBold' : 'subtitle1.fontWeight',
              }}
              noWrap
            >
              {label}
            </Typography>
          </Box>
        );
      })}
      {profile.showMore && (
        <Box
          component="button"
          type="button"
          aria-controls={context.navigation.controlsId}
          aria-expanded={context.navigation.expanded}
          aria-label={t('dwaionMobileNavigation.more')}
          onClick={(event) => context.navigation.onOpen(event.currentTarget)}
          sx={{
            flex: '1 1 0',
            minWidth: 0,
            minHeight: 44,
            m: 0,
            p: 0,
            border: 0,
            bgcolor: 'transparent',
            color: 'text.secondary',
            font: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.2,
            cursor: 'pointer',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            },
          }}
        >
          <Menu size={19} strokeWidth={1.8} aria-hidden="true" />
          <Typography
            component="span"
            sx={{
              fontSize: 'overline.fontSize',
              lineHeight: 'button.lineHeight',
              fontWeight: 'subtitle1.fontWeight',
            }}
          >
            {t('dwaionMobileNavigation.more')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export function resolveDwaionProductAreaMobileShell(
  context: ProductAreaMobileShellContext
): ProductAreaMobileShellPresentation {
  const profile = resolveDwaionMobileHeaderProfile(context.pathname, context.search);

  return {
    header: (
      <DwaionMobileHeader
        profile={profile}
        navigation={context.navigation}
        onBack={context.onNavigate}
      />
    ),
    footer: profile.showNavigation ? (
      <DwaionMobileNavigation context={context} profile={profile} />
    ) : undefined,
  };
}
