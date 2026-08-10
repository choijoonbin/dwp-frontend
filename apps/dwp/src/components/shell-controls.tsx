import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronDown, Clock3, Maximize2, Minimize2, Search, ShieldCheck } from 'lucide-react';
import { GlyphSurface } from '@dwp-frontend/design-system';
import { useAuth, usePermissions, WORKSPACE_NAME } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuItem from '@mui/material/MenuItem';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';

import { GlobalSearchDialog } from '../features/search/global-search-dialog';
import { isAppEntitled, localizeHomeApps } from '../features/home/app-launchpad-model';

function WorkspaceBadge() {
  return (
    <GlyphSurface size={26}>
      <Box
        component="span"
        sx={{ color: '#FFFFFF', fontSize: 11, fontWeight: 800, lineHeight: 1, letterSpacing: 0 }}
      >
        D
      </Box>
    </GlyphSurface>
  );
}

export function WorkspaceMenu() {
  const { t } = useTranslation('shell');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        color="inherit"
        aria-label={t('workspace.select')}
        aria-controls={anchor ? 'workspace-menu' : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ minWidth: 0, maxWidth: { xs: 148, md: 280 }, gap: 1, px: 1 }}
      >
        <WorkspaceBadge />
        <Typography
          component="span"
          variant="subtitle2"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {WORKSPACE_NAME}
        </Typography>
        <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
      </Button>

      <Menu
        id="workspace-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem selected onClick={() => setAnchor(null)} sx={{ minWidth: 260, gap: 1.25 }}>
          <WorkspaceBadge />
          <Box>
            <Typography component="p" variant="subtitle2">
              {WORKSPACE_NAME}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workspace.current')}
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </>
  );
}

export function SearchControl() {
  const { t } = useTranslation('shell');
  const { t: tHome } = useTranslation('home');
  const auth = useAuth();
  const { permissions } = usePermissions();
  const [open, setOpen] = useState(false);
  const apps = useMemo(
    () =>
      localizeHomeApps(tHome).filter((app) =>
        isAppEntitled(app, auth.user?.roles ?? [], permissions)
      ),
    [auth.user?.roles, permissions, tHome]
  );
  const includeWork = apps.some((app) => app.id === 'dwp-work');
  const includeAsk = apps.some((app) => app.id === 'dwp-ask');
  const shortcut =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K';

  useEffect(() => {
    const openCommand = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (editing || event.defaultPrevented) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', openCommand);
    return () => window.removeEventListener('keydown', openCommand);
  }, []);

  return (
    <>
      <ButtonBase
        aria-label={t('search.label')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        sx={{
          width: { md: 184, xl: 208 },
          height: 38,
          px: 1.25,
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1,
          color: 'text.secondary',
          bgcolor: 'action.hover',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          textAlign: 'left',
          transition: (theme) => theme.transitions.create(['border-color', 'background-color']),
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.selected' },
        }}
      >
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <Typography variant="body2" sx={{ flex: 1 }}>
          {t('search.shortPlaceholder')}
        </Typography>
        <Box
          component="kbd"
          sx={{
            px: 0.6,
            py: 0.15,
            border: 1,
            borderColor: 'divider',
            borderRadius: 0.75,
            bgcolor: 'background.paper',
            color: 'text.secondary',
            font: 'inherit',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {shortcut}
        </Box>
      </ButtonBase>
      <Tooltip title={t('search.label')}>
        <IconButton
          aria-label={t('search.label')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          sx={{ display: { xs: 'inline-flex', md: 'none' } }}
        >
          <Search size={20} strokeWidth={1.8} />
        </IconButton>
      </Tooltip>
      <GlobalSearchDialog
        open={open}
        apps={apps}
        includeWork={includeWork}
        includeAsk={includeAsk}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function FullscreenControl() {
  const { t } = useTranslation('shell');
  const [supported, setSupported] = useState(
    () =>
      typeof document !== 'undefined' &&
      document.fullscreenEnabled === true &&
      typeof document.documentElement.requestFullscreen === 'function' &&
      typeof document.exitFullscreen === 'function'
  );
  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  );

  useEffect(() => {
    if (!supported) return;

    const syncFullscreenState = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();

    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, [supported]);

  if (!supported) return null;

  const label = fullscreen ? t('fullscreen.exit') : t('fullscreen.enter');
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setSupported(false);
    }
  };

  return (
    <Tooltip title={label} enterDelay={500}>
      <IconButton
        data-testid="fullscreen-control"
        aria-label={label}
        aria-pressed={fullscreen}
        onClick={() => void toggleFullscreen()}
        sx={{
          display: { xs: 'none', md: 'inline-flex' },
          width: 36,
          height: 36,
          borderRadius: 1,
          color: fullscreen ? 'primary.main' : 'text.secondary',
          bgcolor: fullscreen ? 'action.selected' : 'transparent',
          boxShadow: (theme) =>
            fullscreen ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.28)}` : 'none',
          transition: (theme) =>
            theme.transitions.create(['color', 'background-color', 'box-shadow']),
          '&:hover': {
            color: 'text.primary',
            bgcolor: 'action.hover',
          },
        }}
      >
        {fullscreen ? (
          <Minimize2 size={20} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <Maximize2 size={20} strokeWidth={1.8} aria-hidden="true" />
        )}
      </IconButton>
    </Tooltip>
  );
}

export function NotificationMenu() {
  const { t } = useTranslation('shell');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={t('notifications.label')}>
        <IconButton
          aria-label={t('notifications.label')}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <Badge color="error" badgeContent={2} max={9}>
            <Bell size={20} strokeWidth={1.8} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 320, sm: 380 }, mt: 1 } } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography component="h2" variant="subtitle1">
            {t('notifications.label')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('notifications.newCount', { count: 2 })}
          </Typography>
        </Box>
        <Divider />
        <ButtonBase
          onClick={() => setAnchor(null)}
          sx={{ width: 1, p: 2, alignItems: 'flex-start', gap: 1.5, textAlign: 'left' }}
        >
          <Box sx={{ color: 'warning.main', mt: 0.25 }}>
            <Clock3 size={18} aria-hidden="true" />
          </Box>
          <Box>
            <Typography component="p" variant="subtitle2">
              {t('notifications.approval.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('notifications.approval.description')}
            </Typography>
          </Box>
        </ButtonBase>
        <Divider />
        <ButtonBase
          onClick={() => setAnchor(null)}
          sx={{ width: 1, p: 2, alignItems: 'flex-start', gap: 1.5, textAlign: 'left' }}
        >
          <Box sx={{ color: 'success.main', mt: 0.25 }}>
            <ShieldCheck size={18} aria-hidden="true" />
          </Box>
          <Box>
            <Typography component="p" variant="subtitle2">
              {t('notifications.policy.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('notifications.policy.description', { count: 4 })}
            </Typography>
          </Box>
        </ButtonBase>
      </Popover>
    </>
  );
}
