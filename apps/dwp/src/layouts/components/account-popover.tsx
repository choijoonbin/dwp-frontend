import type { IconButtonProps } from '@mui/material/IconButton';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMe, useAuth, redirectToSignIn } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuItem, { menuItemClasses } from '@mui/material/MenuItem';

import { useRouter, usePathname } from 'src/routes/hooks';

import { useThemeMode } from 'src/theme/theme-mode';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type AccountPopoverProps = IconButtonProps & {
  data?: {
    label: string;
    href: string;
    icon?: React.ReactNode;
    info?: React.ReactNode;
  }[];
};

export function AccountPopover({ data = [], sx, ...other }: AccountPopoverProps) {
  const { t } = useTranslation('common');
  const { mode, toggleMode } = useThemeMode();
  const router = useRouter();
  const pathname = usePathname();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'account-popover'],
    queryFn: async () => {
      const res = await getMe();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch me');
      }
      return res.data as Record<string, unknown>;
    },
    enabled: auth.isAuthenticated,
    retry: false,
  });

  const me = meQuery.data;
  const displayName =
    (typeof me?.displayName === 'string' && me.displayName.trim()) ||
    (typeof me?.name === 'string' && me.name.trim()) ||
    (typeof me?.username === 'string' && me.username.trim()) ||
    (typeof me?.loginId === 'string' && me.loginId.trim()) ||
    'User';
  const email =
    (typeof me?.email === 'string' && me.email.trim()) ||
    (typeof me?.loginId === 'string' && me.loginId.trim()) ||
    '';
  const photoUrl =
    (typeof me?.photoURL === 'string' && me.photoURL.trim()) ||
    (typeof me?.photoUrl === 'string' && me.photoUrl.trim()) ||
    undefined;
  const initial = displayName.charAt(0).toUpperCase();

  const [openPopover, setOpenPopover] = useState<HTMLButtonElement | null>(null);

  const handleOpenPopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setOpenPopover(event.currentTarget);
  }, []);

  const handleClosePopover = useCallback(() => {
    setOpenPopover(null);
  }, []);

  const handleClickItem = useCallback(
    (path: string) => {
      handleClosePopover();
      router.push(path);
    },
    [handleClosePopover, router]
  );

  const handleLogout = useCallback(() => {
    handleClosePopover();
    auth.logout();
    redirectToSignIn(navigate, location);
  }, [auth, handleClosePopover, location, navigate]);

  const handleToggleTheme = useCallback(() => {
    toggleMode();
    handleClosePopover();
  }, [handleClosePopover, toggleMode]);

  return (
    <>
      <IconButton
        onClick={handleOpenPopover}
        sx={{
          p: '2px',
          width: 40,
          height: 40,
          background: (theme) =>
            `conic-gradient(${theme.vars.palette.primary.light}, ${theme.vars.palette.warning.light}, ${theme.vars.palette.primary.light})`,
          ...sx,
        }}
        {...other}
      >
        <Avatar src={photoUrl} alt={displayName} sx={{ width: 1, height: 1 }}>
          {initial}
        </Avatar>
      </IconButton>

      <Popover
        open={!!openPopover}
        anchorEl={openPopover}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: 200 },
          },
        }}
      >
        <Box sx={{ p: 2, pb: 1.5 }}>
          <Typography variant="subtitle2" noWrap>
            {displayName}
          </Typography>

          <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
            {email}
          </Typography>
        </Box>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <MenuList
          disablePadding
          sx={{
            p: 1,
            gap: 0.5,
            display: 'flex',
            flexDirection: 'column',
            [`& .${menuItemClasses.root}`]: {
              px: 1,
              gap: 2,
              borderRadius: 0.75,
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
              [`&.${menuItemClasses.selected}`]: {
                color: 'text.primary',
                bgcolor: 'action.selected',
                fontWeight: 'fontWeightSemiBold',
              },
            },
          }}
        >
          {data.map((option) => (
            <MenuItem
              key={option.label}
              selected={option.href === pathname}
              onClick={() => handleClickItem(option.href)}
            >
              {option.icon}
              {option.label}
            </MenuItem>
          ))}
          <MenuItem onClick={handleToggleTheme}>
            <Iconify width={22} icon={mode === 'light' ? 'solar:eye-closed-bold' : 'solar:eye-bold'} />
            {t('theme.switchTo', { mode: t(mode === 'light' ? 'theme.darkMode' : 'theme.lightMode') })}
          </MenuItem>
        </MenuList>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Box sx={{ p: 1 }}>
          <Button fullWidth color="error" size="medium" variant="text" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Popover>
    </>
  );
}
