import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Menu } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { AccountMenu } from './account-menu';
import {
  FullscreenControl,
  NotificationMenu,
  SearchControl,
  WorkspaceIdentity,
} from './shell-controls';

import {
  shellHeaderHeight,
  type ShellKey,
  type ShellScope,
} from '../features/shell/shell-registry';
import { resolveGlobalSearchPersona } from '../features/search/global-search-access-policy';

import type { SxProps, Theme } from '@mui/material/styles';

export type ShellHeaderContext = {
  icon: LucideIcon;
  label: string;
  detail?: string;
};

type ShellHeaderProps = {
  context?: ShellHeaderContext;
  desktopOffset?: number;
  position?: 'fixed' | 'sticky';
  surface?: 'solid' | 'glass';
  testId?: string;
  shellKey: ShellKey;
  scope: ShellScope;
  brand?: ReactNode;
  leading?: ReactNode;
  navigation?: {
    controlsId?: string;
    expanded?: boolean;
    label: string;
    testId?: string;
    onOpen: (trigger: HTMLButtonElement) => void;
  };
  showWorkspace?: boolean;
  primaryNavigation?: ReactNode;
  mobilePrimaryNavigation?: ReactNode;
  mobileContextRail?: ReactNode;
  contextControls?: ReactNode;
  compactSearch?: boolean;
  maxContentWidth?: number;
  trailing?: ReactNode;
  sx?: SxProps<Theme>;
};

export const shellMobileContextRailHeight = 44;

export function ShellHeader({
  context,
  desktopOffset = 0,
  position = 'fixed',
  surface = 'solid',
  testId,
  shellKey,
  scope,
  brand,
  leading,
  navigation,
  showWorkspace = false,
  primaryNavigation,
  mobilePrimaryNavigation,
  mobileContextRail,
  contextControls,
  compactSearch = false,
  maxContentWidth,
  trailing,
  sx,
}: ShellHeaderProps) {
  const glass = surface === 'glass';
  const ContextIcon = context?.icon;
  const auth = useAuth();
  const searchPersona = resolveGlobalSearchPersona(auth.user);

  return (
    <AppBar
      component="header"
      data-testid={testId}
      data-dwp-shell={shellKey}
      data-dwp-shell-scope={scope}
      data-dwp-shell-context={context?.label}
      position={position}
      color="default"
      elevation={0}
      sx={[
        {
          width: { xs: 1, lg: desktopOffset ? `calc(100% - ${desktopOffset}px)` : 1 },
          ml: { xs: 0, lg: desktopOffset ? `${desktopOffset}px` : 0 },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: glass
            ? (theme: Theme) => alpha(theme.palette.background.paper, 0.88)
            : 'background.paper',
          backdropFilter: glass ? 'blur(22px) saturate(150%)' : 'none',
          WebkitBackdropFilter: glass ? 'blur(22px) saturate(150%)' : 'none',
          transition: (theme) => theme.transitions.create(['width', 'margin-left']),
          containerType: 'inline-size',
          containerName: 'dwp-shell-header',
          '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': glass
            ? {
                bgcolor: 'background.paper',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }
            : undefined,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Toolbar
        disableGutters
        sx={{
          width: 1,
          maxWidth: maxContentWidth,
          minHeight: `${shellHeaderHeight}px !important`,
          mx: maxContentWidth ? 'auto' : 0,
          px: { xs: 1, sm: 1.5, md: 2 },
          gap: 0.5,
        }}
      >
        {navigation && (
          <Box
            sx={{
              display: { lg: 'none' },
              flex: '0 0 auto',
            }}
          >
            <ActionIconButton
              data-testid={navigation.testId}
              aria-controls={navigation.controlsId}
              aria-expanded={navigation.expanded}
              label={navigation.label}
              tooltipPlacement="bottom"
              tooltipDisablePortal
              tooltipDisableInteractive
              onClick={(event) => navigation.onOpen(event.currentTarget)}
              sx={{ width: 40, height: 40 }}
            >
              <Menu size={21} strokeWidth={1.8} aria-hidden="true" />
            </ActionIconButton>
          </Box>
        )}

        {leading}
        {brand}

        {context && ContextIcon && (
          <Box
            data-testid="shell-application-context"
            sx={{
              minWidth: 0,
              maxWidth: { xs: 132, sm: 220, xl: 280 },
              display: 'flex',
              // Product surface controls and global utilities share the first
              // mobile row. Do not let those fixed controls collapse a short
              // product name into an ambiguous one-character ellipsis. The
              // surface control already moves to its rail at <=360px.
              flex: mobilePrimaryNavigation ? { xs: '0 0 auto', sm: '0 1 auto' } : '0 1 auto',
              alignItems: 'center',
              gap: 1,
              px: 0.5,
              ...(mobilePrimaryNavigation
                ? {
                    '@container dwp-shell-header (max-width: 360px)': {
                      display: 'none',
                    },
                  }
                : undefined),
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 32,
                height: 32,
                flex: '0 0 32px',
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'action.selected',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <ContextIcon size={18} strokeWidth={1.8} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                variant="subtitle2"
                title={context.label}
                noWrap
                sx={{ display: 'block', minWidth: 0 }}
              >
                {context.label}
              </Typography>
              {context.detail && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  title={context.detail}
                  noWrap
                  sx={{ display: 'block', minWidth: 0, lineHeight: 1.15 }}
                >
                  {context.detail}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {showWorkspace && (
          <Box
            sx={{
              ml: 0.5,
              display: { xs: 'none', md: 'block' },
              flex: '0 1 auto',
              '@container dwp-shell-header (max-width: 900px)': { display: 'none' },
              ...(primaryNavigation
                ? {
                    '@container dwp-shell-header (max-width: 1400px)': { display: 'none' },
                  }
                : undefined),
            }}
          >
            <WorkspaceIdentity />
          </Box>
        )}

        {primaryNavigation && (
          <Box
            sx={{
              ml: 1,
              minWidth: 0,
              display: { xs: 'none', lg: 'block' },
            }}
          >
            {primaryNavigation}
          </Box>
        )}

        {mobilePrimaryNavigation && (
          <Box sx={{ ml: 0.5, minWidth: 0, display: { xs: 'block', lg: 'none' } }}>
            {mobilePrimaryNavigation}
          </Box>
        )}

        {contextControls && (
          <Box sx={mobileContextRail ? { display: { xs: 'none', lg: 'block' } } : undefined}>
            {contextControls}
          </Box>
        )}

        <Box sx={{ flexGrow: 1, minWidth: 4 }} />

        <Box
          data-testid="shell-global-actions"
          sx={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}
        >
          {searchPersona.searchVisible && (
            <Box
              data-shell-global-action="search"
              sx={{
                display: 'flex',
                // At the narrowest supported width, preserve the primary
                // notification, account, and assistant actions without making
                // the header horizontally scrollable. The search command
                // remains available through its global keyboard shortcut.
                '@container dwp-shell-header (max-width: 359px)': { display: 'none' },
              }}
            >
              <SearchControl compact={compactSearch} />
            </Box>
          )}
          <Box
            sx={{
              ml: { xs: 0, md: 1 },
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0, sm: 0.25 },
            }}
          >
            <FullscreenControl />
            {!searchPersona.providerAccount && <NotificationMenu />}
          </Box>
          <Box
            sx={{
              ml: { xs: 0.25, sm: 0.75 },
              pl: { xs: 0.25, sm: 1 },
              borderLeft: 1,
              borderColor: 'divider',
            }}
          >
            <AccountMenu
              showIdentity
              collapseIdentityEarly={Boolean(primaryNavigation || mobilePrimaryNavigation)}
            />
          </Box>
          {trailing}
        </Box>
      </Toolbar>
      {mobileContextRail && (
        <Box
          data-testid="shell-mobile-context-rail"
          sx={{
            display: { xs: 'flex', lg: 'none' },
            alignItems: 'center',
            width: 1,
            height: shellMobileContextRailHeight,
            minHeight: shellMobileContextRailHeight,
            px: { xs: 1, sm: 1.5 },
            overflow: 'hidden',
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {mobileContextRail}
        </Box>
      )}
    </AppBar>
  );
}
