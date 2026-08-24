import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Home, LifeBuoy, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { BrandLockup } from '../components/brand-lockup';
import { ProviderSupportBanner } from '../components/provider-support-banner';
import { ShellHeader } from '../components/shell-header';
import {
  productSurfaceContentInstanceKey,
  ProductSurfaceContextBar,
  ProductSurfaceSwitcher,
} from '../components/product-surface-controls';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';
import { getProductExperienceProfile } from '../features/shell/product-experience-registry';
import { canContextAccessNavigation } from '../features/shell/product-surface-context';
import {
  DesktopNavigationToggle,
  useDesktopNavigation,
} from '../features/shell/desktop-navigation';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';
import type {
  ProductNavigationGroup as ProductAreaNavigationGroup,
  ProductNavigationItem as ProductAreaNavigationItem,
  ProductSurfaceNavigationItem,
} from '../components/product-manifest';
import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import { canAccessProductAreaNavigationItem } from './product-area-permissions';

export type { ProductAreaNavigationGroup, ProductAreaNavigationItem };

export type ProductAreaLayoutProps = {
  areaKey:
    | 'dwaion'
    | 'work'
    | 'activity'
    | 'communications'
    | 'services'
    | 'hcm'
    | 'calendar'
    | 'rooms'
    | 'approvals'
    | 'mail'
    | 'messaging'
    | 'notifications'
    | 'spaces';
  navigation: readonly ProductAreaNavigationGroup[];
  translationNamespace?:
    | 'workforce'
    | 'work'
    | 'communications'
    | 'services'
    | 'hcm'
    | 'calendar'
    | 'rooms'
    | 'approvals'
    | 'mail'
    | 'messaging'
    | 'notifications'
    | 'spaces';
  surface?: ProductSurfaceLayoutRuntime;
};

function isSurfaceNavigationItem(
  item: ProductAreaNavigationItem
): item is ProductSurfaceNavigationItem {
  return 'access' in item && 'taskKind' in item;
}

export function ProductAreaLayout({
  areaKey,
  navigation,
  translationNamespace = 'workforce',
  surface,
}: ProductAreaLayoutProps) {
  const { t } = useTranslation(translationNamespace);
  const { t: tCommon } = useTranslation('common');
  const { t: tAdmin } = useTranslation('admin');
  const shell = shellRegistry[areaKey];
  const productExperience = getProductExperienceProfile(areaKey);
  const AreaIcon = shell.context.icon;
  const auth = useAuth();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const { pathname } = location;
  const [mobileOpen, setMobileOpen] = useState(false);
  const telemetry = useProductSurfaceTelemetry();
  const {
    compact,
    collapsible,
    desktopOffset,
    sidebarWidth,
    toggle: toggleDesktopNavigation,
  } = useDesktopNavigation(shell);
  const tenantName =
    supportContext.data?.tenantName ||
    auth.user?.tenantName ||
    auth.user?.tenantCode ||
    t('shell.tenantFallback');
  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (surface && isSurfaceNavigationItem(item)) {
          return canContextAccessNavigation(
            item.access,
            surface.decision.context,
            surface.decision.scope.key,
            surface.serverNowMs
          );
        }
        if (surface && !surface.compatibilityNavigation) return false;
        return canAccessProductAreaNavigationItem(item, hasPermission, supportContext.data?.scopes);
      }),
    }))
    .filter((group) => group.items.length > 0);
  const returnTarget = supportContext.data
    ? { path: '/provider/support', label: tAdmin('supportMode.backToProvider') }
    : (surface?.returnTarget ?? { path: '/', label: t('shell.backToHome') });
  const SurfaceIcon = surface?.decision.context.plane === 'management' ? ShieldCheck : AreaIcon;
  const contentInstanceKey = surface
    ? productSurfaceContentInstanceKey({
        contextKey: surface.decision.context.contextKey,
        surfaceKey: surface.decision.context.surfaceKey,
        contextScopeKey: surface.decision.scope.key,
        decisionRevision: surface.decision.decisionRevision,
      })
    : 'legacy';
  const returnSurface = surface?.entryPoints?.find((entry) => entry.path === returnTarget.path);

  const navigationContent = (
    compactNavigation: boolean,
    onNavigate?: () => void,
    showSurfaceSwitcher = false
  ) => (
    <Box sx={{ height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          minHeight: shellHeaderHeight,
          px: compactNavigation ? 0 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compactNavigation ? 'center' : 'flex-start',
        }}
      >
        <BrandLockup variant={compactNavigation ? 'product-only' : 'product-full'} />
      </Box>
      {showSurfaceSwitcher && surface?.entryPoints && surface.entryPoints.length > 1 && (
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <ProductSurfaceSwitcher
            currentSurfaceId={surface.decision.context.surfaceKey}
            entries={surface.entryPoints}
            label={tCommon('productSurface.labels.surfaceNavigation')}
            resolveLabel={(labelKey) => t(labelKey)}
            onNavigate={onNavigate}
          />
        </Box>
      )}
      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 1, display: compactNavigation ? 'none' : 'block' }}>
        <Typography component="p" variant="overline" sx={{ color: 'var(--dwp-product-accent)' }}>
          {surface?.label ?? t(`shell.${areaKey}.context`)}
        </Typography>
        <Typography variant="body2" fontWeight={750} noWrap>
          {tenantName}
        </Typography>
        {surface && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {surface.decision.scope.displayName}
            {surface.decision.effectiveReadOnly
              ? ` · ${tCommon('productSurface.labels.readOnly')}`
              : ''}
          </Typography>
        )}
      </Box>
      <Box
        component="nav"
        aria-label={t(`shell.${areaKey}.navigationLabel`)}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
        {visibleNavigation.map((group) => (
          <Box key={group.id} sx={{ pb: 1.25 }}>
            {!compactNavigation && (
              <Typography
                component="p"
                variant="overline"
                color="text.secondary"
                sx={{ px: 2.5, py: 0.75 }}
              >
                {t(`navigation.groups.${areaKey}.${group.id}`)}
              </Typography>
            )}
            <List
              disablePadding
              sx={{ display: 'grid', gap: 0.35, px: compactNavigation ? 1 : 1.25 }}
            >
              {group.items.map((item) => {
                const Icon = item.icon;
                const selected =
                  pathname === item.path ||
                  (item.path !== '/' && pathname.startsWith(`${item.path}/`));
                const label = t(`navigation.items.${areaKey}.${item.view}.label`);
                return (
                  <Box component="li" key={item.path} sx={{ display: 'block' }}>
                    <Tooltip title={compactNavigation ? label : ''} placement="right">
                      <ListItemButton
                        component={NavLink}
                        to={{
                          pathname: item.path,
                          search: surface ? location.search : '',
                          hash: surface ? location.hash : '',
                        }}
                        selected={selected}
                        aria-label={compactNavigation ? label : undefined}
                        aria-current={selected ? 'page' : undefined}
                        onClick={onNavigate}
                        sx={{
                          minHeight: 42,
                          justifyContent: compactNavigation ? 'center' : 'flex-start',
                          px: compactNavigation ? 1 : 1.25,
                          borderRadius: 1,
                          position: 'relative',
                          color: selected ? 'var(--dwp-product-accent)' : 'text.secondary',
                          '&.Mui-selected': { bgcolor: 'var(--dwp-product-selection)' },
                          '&.Mui-selected:hover': { bgcolor: 'var(--dwp-product-selection)' },
                          '&.Mui-selected::before': {
                            content: '""',
                            position: 'absolute',
                            inset: '8px auto 8px 0',
                            width: 3,
                            borderRadius: '0 3px 3px 0',
                            bgcolor: 'var(--dwp-product-accent)',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: compactNavigation ? 0 : 34,
                            justifyContent: 'center',
                            color: 'inherit',
                          }}
                        >
                          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                        </ListItemIcon>
                        {!compactNavigation && (
                          <ListItemText
                            primary={label}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: selected ? 750 : 600,
                            }}
                          />
                        )}
                      </ListItemButton>
                    </Tooltip>
                  </Box>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: compactNavigation ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Tooltip title={compactNavigation ? returnTarget.label : ''} placement="right">
          <ActionButton
            component={NavLink}
            to={returnTarget.path}
            fullWidth
            intent="quiet"
            aria-label={compactNavigation ? returnTarget.label : undefined}
            startIcon={
              supportContext.data ? (
                <LifeBuoy size={17} strokeWidth={1.8} />
              ) : surface ? (
                <ArrowLeft size={17} strokeWidth={1.8} />
              ) : (
                <Home size={17} strokeWidth={1.8} />
              )
            }
            onClick={() => {
              if (surface && returnSurface) {
                telemetry.captureReturn(
                  surface.decision.context.productKey,
                  surface.decision.context.surfaceKey,
                  returnSurface.surfaceId
                );
              }
              onNavigate?.();
            }}
            sx={{
              justifyContent: compactNavigation ? 'center' : 'flex-start',
              minWidth: 0,
              px: compactNavigation ? 1 : undefined,
              '& .MuiButton-startIcon': { m: compactNavigation ? 0 : undefined },
            }}
          >
            {!compactNavigation && returnTarget.label}
          </ActionButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box
      data-testid={`${areaKey}-shell`}
      data-product-surface={surface?.decision.context.surfaceKey}
      data-product-plane={surface?.decision.context.plane}
      data-dwp-navigation-state={compact ? 'compact' : 'expanded'}
      data-product-concept={productExperience.concept}
      data-product-density={productExperience.density}
      sx={(theme) => ({
        minHeight: '100dvh',
        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : productExperience.canvas,
        '--dwp-product-accent': productExperience.accent,
        '--dwp-product-secondary': productExperience.secondary,
        '--dwp-product-soft':
          theme.palette.mode === 'dark'
            ? alpha(productExperience.accent, 0.18)
            : productExperience.softSurface,
        '--dwp-product-canvas':
          theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : productExperience.canvas,
        '--dwp-product-sidebar':
          theme.palette.mode === 'dark'
            ? theme.palette.background.paper
            : productExperience.sidebar,
        '--dwp-product-selection':
          theme.palette.mode === 'dark'
            ? alpha(productExperience.accent, 0.2)
            : productExperience.selection,
      })}
    >
      <Box
        component="aside"
        id={`${areaKey}-desktop-navigation`}
        data-testid={`${areaKey}-sidebar`}
        sx={{
          position: 'fixed',
          inset: '0 auto 0 0',
          width: sidebarWidth,
          zIndex: (theme) => theme.zIndex.drawer,
          display: { xs: 'none', lg: 'block' },
          bgcolor: 'var(--dwp-product-sidebar)',
          borderRight: 1,
          borderColor: 'divider',
          transition: (theme) => theme.transitions.create('width'),
        }}
      >
        {navigationContent(compact, undefined, !compact)}
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{
          paper: {
            'aria-label': t(`shell.${areaKey}.navigationLabel`),
            sx: (theme) => ({
              width: shell.desktopNavigationWidth,
              height: '100dvh',
              overflow: 'hidden',
              bgcolor:
                theme.palette.mode === 'dark'
                  ? theme.palette.background.paper
                  : productExperience.sidebar,
              '--dwp-product-accent': productExperience.accent,
              '--dwp-product-selection':
                theme.palette.mode === 'dark'
                  ? alpha(productExperience.accent, 0.2)
                  : productExperience.selection,
            }),
          },
        }}
      >
        <Box data-testid={`${areaKey}-mobile-sidebar`} sx={{ height: 1, minHeight: 0 }}>
          {navigationContent(false, () => setMobileOpen(false), true)}
        </Box>
      </Drawer>
      <ShellHeader
        testId={`${areaKey}-header`}
        shellKey={shell.key}
        scope={supportContext.data ? 'support' : shell.scope}
        desktopOffset={desktopOffset}
        context={{
          icon: SurfaceIcon,
          label: surface
            ? `${t(`shell.${areaKey}.name`)} · ${surface.label}`
            : t(`shell.${areaKey}.name`),
          detail: surface ? `${tenantName} · ${surface.decision.scope.displayName}` : undefined,
        }}
        navigation={{
          label: t('shell.openNavigation'),
          onOpen: () => setMobileOpen(true),
        }}
        leading={
          collapsible ? (
            <DesktopNavigationToggle
              compact={compact}
              controlsId={`${areaKey}-desktop-navigation`}
              onToggle={toggleDesktopNavigation}
            />
          ) : undefined
        }
        showWorkspace={shell.showWorkspace && !supportContext.data}
        primaryNavigation={
          surface?.entryPoints && compact ? (
            <ProductSurfaceSwitcher
              currentSurfaceId={surface.decision.context.surfaceKey}
              entries={surface.entryPoints}
              label={tCommon('productSurface.labels.surfaceNavigation')}
              resolveLabel={(labelKey) => t(labelKey)}
            />
          ) : undefined
        }
      />
      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        sx={{
          pt: `${shellHeaderHeight}px`,
          width: { xs: 1, lg: `calc(100% - ${desktopOffset}px)` },
          ml: { xs: 0, lg: `${desktopOffset}px` },
          minWidth: 0,
          minHeight: '100dvh',
          overflowX: 'clip',
          outline: 'none',
          bgcolor: 'var(--dwp-product-canvas)',
          transition: (theme) => theme.transitions.create(['width', 'margin-left']),
        }}
      >
        {supportContext.data && <ProviderSupportBanner context={supportContext.data} />}
        {surface && <ProductSurfaceContextBar runtime={surface} />}
        <Outlet key={contentInstanceKey} />
      </Box>
    </Box>
  );
}
