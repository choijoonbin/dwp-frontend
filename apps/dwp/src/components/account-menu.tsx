import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Mail,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth, usePermissions, redirectToSignIn } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { isAppResourceEntitled } from '../features/home/app-launchpad-model';

const menuIconProps = { size: 19, strokeWidth: 1.8, 'aria-hidden': true } as const;

export function AccountMenu({ showIdentity = false }: { showIdentity?: boolean }) {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const { permissions } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const buttonId = useId();
  const panelId = useId();
  const settingsDescriptionId = useId();
  const administrationDescriptionId = useId();
  const displayName = auth.user?.displayName || t('account.fallbackName');
  const positionTitle =
    auth.user?.jobTitle ||
    (auth.user?.roles.includes('PLATFORM_ADMIN')
      ? t('account.roles.platformAdmin')
      : auth.user?.roles.includes('TENANT_ADMIN') || auth.user?.roles.includes('ADMIN')
        ? t('account.roles.tenantAdmin')
        : t('account.roles.member'));
  const isAdmin = Boolean(
    auth.user?.roles.some((role) => ['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN'].includes(role)) &&
      isAppResourceEntitled('APP.ADMINISTRATION', permissions)
  );

  const close = () => setAnchor(null);
  const dismiss = () => {
    const trigger = anchor;
    setAnchor(null);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  };
  const goTo = (path: string) => {
    close();
    navigate(path);
  };
  const logout = async () => {
    close();
    await auth.logout();
    redirectToSignIn(navigate, location);
  };
  return (
    <>
      <Tooltip title={showIdentity ? '' : displayName}>
        <Box
          component="button"
          type="button"
          id={buttonId}
          aria-label={t('account.buttonLabel', { name: displayName, position: positionTitle })}
          aria-haspopup="dialog"
          aria-controls={anchor ? panelId : undefined}
          aria-expanded={Boolean(anchor)}
          onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
          sx={{
            py: 0.5,
            pl: showIdentity ? 1 : 0.5,
            pr: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            color: 'text.primary',
            bgcolor: anchor ? 'action.selected' : 'transparent',
            border: 0,
            borderRadius: 1,
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'right',
            transition: (theme) => theme.transitions.create(['background-color', 'box-shadow']),
            boxShadow: (theme) =>
              anchor ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}` : 'none',
            '&:hover': { bgcolor: anchor ? 'action.selected' : 'action.hover' },
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
          <Box
            component={ChevronDown}
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            sx={{
              transform: anchor ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: (theme) => theme.transitions.create('transform'),
            }}
          />
        </Box>
      </Tooltip>

      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={dismiss}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            id: panelId,
            role: 'dialog',
            'aria-label': t('account.panelLabel'),
            sx: {
              width: { xs: 'calc(100vw - 24px)', sm: 344 },
              maxWidth: 344,
              mt: 1,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          role="presentation"
          sx={{
            px: 2,
            py: 2,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.055),
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                flex: '0 0 auto',
                fontSize: 17,
                fontWeight: 700,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                border: 2,
                borderColor: 'background.paper',
                boxShadow: (theme) => `0 0 0 1px ${theme.palette.divider}`,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography component="p" variant="subtitle1" noWrap>
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {positionTitle}
              </Typography>
            </Box>
            <Tooltip title={t('account.menu.logout')} placement="left">
              <IconButton
                aria-label={t('account.menu.logout')}
                onClick={() => void logout()}
                sx={{
                  width: 32,
                  height: 32,
                  flex: '0 0 auto',
                  color: 'error.main',
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.error.main, 0.16),
                  },
                }}
              >
                <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ mt: 1.5, display: 'grid', gap: 0.75 }}>
            {auth.user?.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Mail size={15} strokeWidth={1.8} aria-hidden="true" />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {auth.user.email}
                </Typography>
              </Box>
            )}
            {auth.user?.tenantCode && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Building2 size={15} strokeWidth={1.8} aria-hidden="true" />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {t('account.workspace', { workspace: auth.user.tenantCode })}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <MenuList
          autoFocusItem={Boolean(anchor)}
          aria-label={t('account.actionsLabel')}
          sx={{ pt: 0, pb: 1 }}
        >
          <MenuItem
            aria-label={t('account.menu.settings')}
            aria-describedby={settingsDescriptionId}
            onClick={() => goTo('/account/profile')}
            sx={{ mx: 1, mt: 1, px: 1, py: 1, gap: 1.25, alignItems: 'center' }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: 'primary.main',
                bgcolor: 'action.selected',
              }}
            >
              <Settings2 {...menuIconProps} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {t('account.menu.settings')}
              </Typography>
              <Typography
                id={settingsDescriptionId}
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block' }}
              >
                {t('account.menu.settingsDescription')}
              </Typography>
            </Box>
            <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
          </MenuItem>
          {isAdmin && (
            <MenuItem
              aria-label={t('account.menu.administration')}
              aria-describedby={administrationDescriptionId}
              onClick={() => goTo('/admin')}
              sx={{ mx: 1, px: 1, py: 1, gap: 1.25, alignItems: 'center' }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: 'secondary.main',
                  bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
                }}
              >
                <ShieldCheck {...menuIconProps} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {t('account.menu.administration')}
                </Typography>
                <Typography
                  id={administrationDescriptionId}
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {t('account.menu.administrationDescription')}
                </Typography>
              </Box>
              <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </MenuItem>
          )}
        </MenuList>
      </Popover>
    </>
  );
}
