import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Cog, Home, LogOut, Moon, Settings2, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useAppearance } from '@dwp-frontend/design-system';
import { useAuth, usePermissions, redirectToSignIn } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import { isAppResourceEntitled } from '../features/home/app-launchpad-model';

const menuIconProps = { size: 19, strokeWidth: 1.8, 'aria-hidden': true } as const;

export function AccountMenu({ showIdentity = false }: { showIdentity?: boolean }) {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const appearance = useAppearance();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const displayName = auth.user?.displayName || 'User';
  const positionTitle =
    auth.user?.jobTitle ||
    (auth.user?.roles.includes('PLATFORM_ADMIN')
      ? 'Platform administrator'
      : auth.user?.roles.includes('TENANT_ADMIN') || auth.user?.roles.includes('ADMIN')
        ? 'Tenant administrator'
        : 'Workspace member');
  const isAdmin = Boolean(
    auth.user?.roles.some((role) => ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN'].includes(role)) &&
      isAppResourceEntitled('APP.ADMINISTRATION', permissions)
  );

  const close = () => setAnchor(null);
  const goTo = (path: string) => {
    close();
    navigate(path);
  };
  const logout = async () => {
    close();
    await auth.logout();
    redirectToSignIn(navigate, location);
  };
  const switchMode = () => {
    appearance.setMode(appearance.resolvedMode === 'dark' ? 'light' : 'dark');
    close();
  };

  return (
    <>
      <Tooltip title={showIdentity ? '' : displayName}>
        <Box
          component="button"
          type="button"
          aria-label={`Account: ${displayName}, ${positionTitle}`}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            p: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'text.primary',
            bgcolor: 'transparent',
            border: 0,
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'right',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 3,
            },
          }}
        >
          {showIdentity && (
            <Box sx={{ minWidth: 0, maxWidth: 190, display: { xs: 'none', md: 'block' } }}>
              <Typography component="span" variant="subtitle2" noWrap sx={{ display: 'block' }}>
                {displayName}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block' }}
              >
                {positionTitle}
              </Typography>
            </Box>
          )}
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: 14,
              bgcolor: 'primary.main',
              border: 1,
              borderColor: 'divider',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
        </Box>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 264, mt: 1, p: 0.5 } } }}
      >
        <Box sx={{ px: 1.5, py: 1.25 }}>
          <Typography component="p" variant="subtitle2" noWrap>
            {displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {positionTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {auth.user?.email || auth.user?.tenantCode || ''}
          </Typography>
        </Box>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => goTo('/')} sx={{ gap: 1.5 }}>
          <Home {...menuIconProps} />
          Home
        </MenuItem>
        <MenuItem onClick={() => goTo('/account/profile')} sx={{ gap: 1.5 }}>
          <UserRound {...menuIconProps} />
          Profile
        </MenuItem>
        <MenuItem onClick={() => goTo('/account/settings')} sx={{ gap: 1.5 }}>
          <Settings2 {...menuIconProps} />
          Preferences
        </MenuItem>
        <MenuItem onClick={() => goTo('/account/security')} sx={{ gap: 1.5 }}>
          <ShieldCheck {...menuIconProps} />
          Security & sessions
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => goTo('/admin')} sx={{ gap: 1.5 }}>
            <Cog {...menuIconProps} />
            Administration
          </MenuItem>
        )}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={switchMode} sx={{ gap: 1.5 }}>
          {appearance.resolvedMode === 'dark' ? (
            <Sun {...menuIconProps} />
          ) : (
            <Moon {...menuIconProps} />
          )}
          {appearance.resolvedMode === 'dark' ? 'Light mode' : 'Dark mode'}
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => void logout()} sx={{ gap: 1.5, color: 'error.main' }}>
          <LogOut {...menuIconProps} />
          Logout
        </MenuItem>
      </Menu>
    </>
  );
}
