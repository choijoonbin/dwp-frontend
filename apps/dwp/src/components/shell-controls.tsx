import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Maximize2, Minimize2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlyphSurface } from '@dwp-frontend/design-system/components/glyph-surface';
import { WORKSPACE_NAME } from '@dwp-frontend/shared-utils/env';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import {
  hasFullTenantAdminRole,
  hasProviderControlPlaneRole,
  hasTenantControlPlaneRole,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';

import {
  isAppEntitled,
  localizeHomeApps,
} from '../components/workspace-composer/app-launchpad-model';
import { NotificationHeaderGlance } from '../features/notifications/notification-header-glance';

const GlobalSearchDialog = lazy(() =>
  import('../features/search/global-search-dialog').then((module) => ({
    default: module.GlobalSearchDialog,
  }))
);

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

export function SearchControl({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('shell');
  const { t: tHome } = useTranslation('home');
  const auth = useAuth();
  const { permissions, hasPermission, isLoaded: permissionsLoaded } = usePermissions();
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
  const includePeople = apps.some((app) => app.id === 'ref-app-people');
  const roles = auth.user?.roles ?? [];
  const includeProvider = hasProviderControlPlaneRole(roles);
  const includeTenantAudit =
    hasTenantControlPlaneRole(roles) &&
    permissionsLoaded &&
    hasPermission('ADMIN.AUDIT_VIEW', 'VIEW');
  const includeTenantCatalog = hasFullTenantAdminRole(roles);
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
          width: compact ? 88 : { md: 184, xl: 208 },
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
          '@container dwp-shell-header (max-width: 900px)': compact
            ? { display: 'none' }
            : undefined,
          '@container dwp-shell-header (min-width: 901px) and (max-width: 1120px)': compact
            ? undefined
            : { display: 'none' },
        }}
      >
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <Typography variant="body2" sx={{ flex: 1, display: compact ? 'none' : 'block' }}>
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
      <Tooltip title={t('search.label')} slotProps={{ popper: { disablePortal: true } }}>
        <IconButton
          aria-label={t('search.label')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            '@container dwp-shell-header (max-width: 1120px)': { display: 'inline-flex' },
          }}
        >
          <Search size={20} strokeWidth={1.8} />
        </IconButton>
      </Tooltip>
      {open ? (
        <Suspense fallback={null}>
          <GlobalSearchDialog
            open
            apps={apps}
            includeWork={includeWork}
            includeAsk={includeAsk}
            includePeople={includePeople}
            includeTenantAudit={includeTenantAudit}
            includeTenantCatalog={includeTenantCatalog}
            includeProvider={includeProvider}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
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
    <Tooltip title={label} enterDelay={500} slotProps={{ popper: { disablePortal: true } }}>
      <IconButton
        data-testid="fullscreen-control"
        aria-label={label}
        aria-pressed={fullscreen}
        onClick={() => void toggleFullscreen()}
        sx={{
          display: { xs: 'none', md: 'inline-flex' },
          '@container dwp-shell-header (max-width: 900px)': { display: 'none' },
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
  const navigate = useNavigate();
  return (
    <NotificationHeaderGlance
      onOpenCenter={(notificationId) =>
        navigate(
          notificationId
            ? `/notifications/center/${encodeURIComponent(notificationId)}`
            : '/notifications/center'
        )
      }
      onOpenSettings={() => navigate('/account/settings/notifications')}
    />
  );
}
