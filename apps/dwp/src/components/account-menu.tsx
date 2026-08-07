import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Iconify, useThemeMode } from '@dwp-frontend/design-system';
import { getMe, useAuth, redirectToSignIn } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

export function AccountMenu() {
  const auth = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await getMe()).data,
    enabled: auth.isAuthenticated,
    retry: false,
  });

  const displayName = meQuery.data?.displayName || 'User';
  const email = meQuery.data?.email || '';

  const logout = () => {
    setAnchorEl(null);
    auth.logout();
    redirectToSignIn(navigate, location);
  };

  const goTo = (path: string) => {
    setAnchorEl(null);
    navigate(path);
  };

  const switchTheme = () => {
    toggleMode();
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={displayName}>
        <IconButton
          aria-label="Account"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            p: '2px',
            background: (theme) =>
              `conic-gradient(${theme.vars.palette.primary.light}, ${theme.vars.palette.warning.light}, ${theme.vars.palette.primary.light})`,
          }}
        >
          <Avatar sx={{ width: 34, height: 34 }}>{displayName.charAt(0).toUpperCase()}</Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 220 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2">{displayName}</Typography>
          {email && (
            <Typography variant="body2" color="text.secondary">
              {email}
            </Typography>
          )}
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <MenuItem onClick={() => goTo('/')} sx={{ gap: 1.5, borderRadius: 0.75 }}>
            <Iconify width={21} icon="solar:home-angle-bold-duotone" />
            Home
          </MenuItem>
          <MenuItem
            onClick={() => goTo('/account/profile')}
            sx={{ gap: 1.5, borderRadius: 0.75 }}
          >
            <Iconify width={21} icon="solar:shield-keyhole-bold-duotone" />
            Profile
          </MenuItem>
          <MenuItem
            onClick={() => goTo('/account/settings')}
            sx={{ gap: 1.5, borderRadius: 0.75 }}
          >
            <Iconify width={21} icon="solar:settings-bold-duotone" />
            Settings
          </MenuItem>
          <MenuItem onClick={switchTheme} sx={{ gap: 1.5, borderRadius: 0.75 }}>
            <Iconify
              width={21}
              icon={mode === 'light' ? 'solar:eye-closed-bold' : 'solar:eye-bold'}
            />
            {mode === 'light' ? 'Dark mode' : 'Light mode'}
          </MenuItem>
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <MenuItem onClick={logout} sx={{ gap: 1.5, borderRadius: 0.75, color: 'error.main' }}>
            <Iconify width={21} icon="solar:arrow-left-bold" />
            Logout
          </MenuItem>
        </Box>
      </Menu>
    </>
  );
}
