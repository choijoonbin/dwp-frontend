import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Maximize2, Minimize2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ContentDialog } from '@dwp-frontend/design-system/components/dialogs/content-dialog';
import { GlyphSurface } from '@dwp-frontend/design-system/components/glyph-surface';
import { getNotificationSummary } from '@dwp-frontend/shared-utils/api/notification-api';
import { WORKSPACE_NAME } from '@dwp-frontend/shared-utils/env';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import {
  hasFullTenantAdminRole,
  hasTenantControlPlaneRole,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';

import { resolveGlobalSearchPersona } from '../features/search/global-search-access-policy';
import { notificationQueryKeys } from '../features/notifications/integration-contract';

import type { ReactNode, Ref } from 'react';

const GlobalSearchDialogRuntime = lazy(() =>
  import('../features/search/global-search-dialog-runtime').then((module) => ({
    default: module.GlobalSearchDialogRuntime,
  }))
);
const NotificationHeaderGlance = lazy(() =>
  import('../features/notifications/notification-header-glance').then((module) => ({
    default: module.NotificationHeaderGlance,
  }))
);
const SHELL_LAZY_OVERLAY_TIMEOUT_MS = 10_000;

class ShellControlErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onFailure?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

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

export function WorkspaceIdentity() {
  const { t } = useTranslation('shell');

  return (
    <Box
      data-testid="shell-workspace-identity"
      title={t('workspace.current')}
      sx={{
        minWidth: 0,
        maxWidth: { xs: 148, md: 280 },
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
      }}
    >
      <WorkspaceBadge />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="span"
          variant="subtitle2"
          sx={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {WORKSPACE_NAME}
        </Typography>
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', lineHeight: 1.1 }}
        >
          {t('workspace.current')}
        </Typography>
      </Box>
    </Box>
  );
}

export function SearchControl({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const { permissions, hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const [open, setOpen] = useState(false);
  const roles = useMemo(() => auth.user?.roles ?? [], [auth.user?.roles]);
  const persona = resolveGlobalSearchPersona(auth.user);
  const includeProvider = persona.providerSourcesEnabled;
  const includeTenantAudit =
    persona.tenantSourcesEnabled &&
    hasTenantControlPlaneRole(roles) &&
    permissionsLoaded &&
    hasPermission('ADMIN.AUDIT_VIEW', 'VIEW');
  const includeTenantCatalog = persona.tenantSourcesEnabled && hasFullTenantAdminRole(roles);
  const shortcut =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K';

  useEffect(() => {
    if (!persona.searchVisible) return;
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
  }, [persona.searchVisible]);

  if (!persona.searchVisible) return null;

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
        <ShellControlErrorBoundary
          fallback={
            <SearchDialogErrorState
              title={t('search.loadError')}
              reloadLabel={t('search.reloadPage')}
              closeLabel={t('search.close')}
              onReload={() => window.location.reload()}
              onClose={() => setOpen(false)}
            />
          }
        >
          <Suspense
            fallback={
              <ShellLazyDialogLoadingState
                open
                label={t('search.loadingApps')}
                slowLabel={t('search.loadingSlow')}
                closeLabel={t('search.close')}
                reloadLabel={t('search.reloadPage')}
                onClose={() => setOpen(false)}
                onReload={() => window.location.reload()}
              />
            }
          >
            <GlobalSearchDialogRuntime
              open
              roles={roles}
              permissions={permissions}
              legacyRoleFallbackAllowed={auth.user?.legacyRoleFallbackAllowed === true}
              tenantSourcesEnabled={persona.tenantSourcesEnabled}
              includeTenantAudit={includeTenantAudit}
              includeTenantCatalog={includeTenantCatalog}
              includeProvider={includeProvider}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        </ShellControlErrorBoundary>
      ) : null}
    </>
  );
}

function SearchDialogErrorState({
  title,
  reloadLabel,
  closeLabel,
  onReload,
  onClose,
}: {
  title: string;
  reloadLabel: string;
  closeLabel: string;
  onReload: () => void;
  onClose: () => void;
}) {
  return (
    <ShellDialogStateFrame label={title} closeLabel={closeLabel} onClose={onClose}>
      <Typography role="alert" color="error.main">
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <ButtonBase
          onClick={onReload}
          sx={{ minHeight: 40, px: 2, borderRadius: 1, color: 'primary.main' }}
        >
          {reloadLabel}
        </ButtonBase>
        <ButtonBase onClick={onClose} sx={{ minHeight: 40, px: 2, borderRadius: 1 }}>
          {closeLabel}
        </ButtonBase>
      </Box>
    </ShellDialogStateFrame>
  );
}

function ShellLazyDialogLoadingState({
  open,
  label,
  slowLabel,
  closeLabel,
  reloadLabel,
  onClose,
  onReload,
}: {
  open: boolean;
  label: string;
  slowLabel: string;
  closeLabel: string;
  reloadLabel: string;
  onClose: () => void;
  onReload: () => void;
}) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!open) {
      setTimedOut(false);
      return undefined;
    }
    const timeout = window.setTimeout(() => setTimedOut(true), SHELL_LAZY_OVERLAY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const statusLabel = timedOut ? slowLabel : label;
  return (
    <ContentDialog
      open={open}
      title={statusLabel}
      closeLabel={closeLabel}
      maxWidth="xs"
      onClose={onClose}
      contentSx={{ py: 3 }}
    >
      <Box sx={{ display: 'grid', justifyItems: 'start', gap: 1.5 }}>
        <Typography role="status" aria-live="polite" color="text.secondary">
          {statusLabel}
        </Typography>
        {timedOut && (
          <ButtonBase
            onClick={onReload}
            sx={{ minHeight: 40, px: 2, borderRadius: 1, color: 'primary.main' }}
          >
            {reloadLabel}
          </ButtonBase>
        )}
      </Box>
    </ContentDialog>
  );
}

function ShellDialogStateFrame({
  label,
  closeLabel,
  onClose,
  children,
}: {
  label: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ContentDialog
      open
      title={label}
      closeLabel={closeLabel}
      maxWidth="sm"
      onClose={onClose}
      contentSx={{ p: 0 }}
      slotProps={{
        paper: {
          sx: {
            alignSelf: 'flex-start',
            mt: { xs: 1.5, sm: 8 },
            mx: { xs: 1.5, sm: 3 },
            width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
          },
        },
      }}
    >
      <Box
        sx={{
          minHeight: 120,
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
          gap: 1,
        }}
      >
        {children}
      </Box>
    </ContentDialog>
  );
}

function NotificationRuntimeButton({
  label,
  badgeContent = 0,
  busy = false,
  error = false,
  expanded = false,
  buttonRef,
  onActivate,
}: {
  label: string;
  badgeContent?: number;
  busy?: boolean;
  error?: boolean;
  expanded?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onActivate?: () => void;
}) {
  return (
    <IconButton
      ref={buttonRef}
      disabled={busy}
      color={error ? 'error' : 'default'}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-busy={busy || undefined}
      onClick={onActivate}
    >
      <Badge color="error" badgeContent={badgeContent} max={99} invisible={badgeContent === 0}>
        <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
      </Badge>
    </IconButton>
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
  const { t } = useTranslation('shell');
  const { t: tNotifications } = useTranslation('notifications');
  const auth = useAuth();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [loadRequested, setLoadRequested] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [triggerLabel, setTriggerLabel] = useState(t('notifications.label'));
  const [badgeContent, setBadgeContent] = useState(0);
  const notificationAuthorized = Boolean(
    auth.isAuthenticated &&
    auth.user &&
    permissionsLoaded &&
    hasPermission('APP.NOTIFICATIONS', 'VIEW')
  );
  const summaryQuery = useQuery({
    queryKey: notificationQueryKeys.summary(),
    queryFn: ({ signal }) => getNotificationSummary(signal),
    enabled: notificationAuthorized,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  useEffect(() => {
    const summary = summaryQuery.data;
    if (!summary) return;
    setTriggerLabel(
      tNotifications('glance.triggerLabel', {
        actionable: summary.actionableUnread,
        total: summary.totalUnread,
      })
    );
    setBadgeContent(summary.totalUnread);
  }, [summaryQuery.data, tNotifications]);

  useEffect(() => {
    if (notificationAuthorized) return;
    setLoadRequested(false);
    setRuntimeReady(false);
    setOpen(false);
    setLoadFailed(false);
    setTriggerLabel(t('notifications.label'));
    setBadgeContent(0);
  }, [notificationAuthorized, t]);

  const dismiss = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const fail = useCallback(() => {
    setRuntimeReady(false);
    setLoadFailed(true);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const updateTrigger = useCallback((label: string, totalUnread: number) => {
    setRuntimeReady(true);
    setTriggerLabel(label);
    setBadgeContent(totalUnread);
  }, []);
  const activate = () => {
    if (loadFailed) {
      window.location.reload();
      return;
    }
    setOpen(true);
    setLoadRequested(true);
  };

  if (!notificationAuthorized) return null;

  return (
    <Box component="span" data-testid="shell-notification-control" sx={{ display: 'inline-flex' }}>
      <Tooltip title={loadFailed ? t('notifications.reloadPage') : triggerLabel}>
        <span style={{ display: 'inline-flex' }}>
          <NotificationRuntimeButton
            buttonRef={triggerRef}
            label={loadFailed ? t('notifications.reloadPage') : triggerLabel}
            badgeContent={badgeContent}
            busy={open && loadRequested && !runtimeReady && !loadFailed}
            error={loadFailed}
            expanded={open}
            onActivate={activate}
          />
        </span>
      </Tooltip>
      {loadFailed && (
        <Box
          component="span"
          role="alert"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            p: 0,
            m: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {t('notifications.reloadPage')}
        </Box>
      )}
      {loadRequested && !loadFailed ? (
        <ShellControlErrorBoundary fallback={null} onFailure={fail}>
          <Suspense
            fallback={
              <ShellLazyDialogLoadingState
                open={open}
                label={t('notifications.loading')}
                slowLabel={t('notifications.loadingSlow')}
                closeLabel={t('notifications.close')}
                reloadLabel={t('notifications.reloadPage')}
                onClose={dismiss}
                onReload={() => window.location.reload()}
              />
            }
          >
            <NotificationHeaderGlance
              open={open}
              anchorEl={triggerRef.current}
              onDismiss={dismiss}
              onTriggerUpdate={updateTrigger}
              onOpenCenter={(notificationId) => {
                setOpen(false);
                navigate(
                  notificationId
                    ? `/notifications/center/${encodeURIComponent(notificationId)}`
                    : '/notifications/center'
                );
              }}
              onOpenSettings={() => {
                setOpen(false);
                navigate('/notifications/settings');
              }}
            />
          </Suspense>
        </ShellControlErrorBoundary>
      ) : null}
    </Box>
  );
}
