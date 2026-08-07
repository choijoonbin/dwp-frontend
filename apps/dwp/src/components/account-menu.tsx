import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LogOut, Moon, Settings2, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useAppearance } from '@dwp-frontend/design-system';
import { useAuth, redirectToSignIn } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

const menuIconProps = { size: 19, strokeWidth: 1.8, 'aria-hidden': true } as const;

export function AccountMenu() {
  const auth = useAuth();
  const appearance = useAppearance();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const displayName = auth.user?.displayName || 'User';

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
      <Tooltip title={displayName}>
        <IconButton
          aria-label="Account"
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ p: 0.25, border: 1, borderColor: 'divider' }}
        >
          <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main' }}>
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
        </IconButton>
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
          <Typography variant="subtitle2" noWrap>
            {displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
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
