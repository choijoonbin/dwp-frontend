import { useTranslation } from 'react-i18next';
import { ArrowLeft, Home, LifeBuoy, Settings2 } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppearance } from '@dwp-frontend/design-system/appearance';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import {
  PRODUCT_EXPERIENCE_SELECTION_OPACITY,
  PRODUCT_EXPERIENCE_SOFT_OPACITY,
  resolveProductExperienceTones,
} from '@dwp-frontend/design-system/foundation/product-experience-tokens';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

import { DesktopNavigationHeader } from '../components/desktop-navigation-header';
import { ShellHeader, shellMobileContextRailHeight } from '../components/shell-header';
import { productSurfaceContentInstanceKey } from '../components/product-surface-content-instance-key';
import ProductSurfaceHeaderControls from '../components/product-surface-header-controls';
import { ProductSurfaceContextBarSlot } from '../components/product-surface-context-bar-slot';
import { shellHeaderHeight, shellRegistry } from '../features/shell/shell-registry';
import { getProductExperienceProfile } from '../features/shell/product-experience-registry';
import { buildLegacyProductSurfacePresentation } from '../features/shell/legacy-product-surface-presentation';
import { canContextAccessNavigation } from '../features/shell/product-surface-context';
import { resolveProductCompatibilityNavigationLocation } from '../features/shell/product-surface-compatibility-navigation';
import { useDesktopNavigation } from '../features/shell/desktop-navigation';
import {
  ShellMobileNavigationDrawer,
  useShellMobileNavigation,
} from '../features/shell/shell-mobile-navigation';
import {
  ProductSurfaceTelemetryExposure,
  useProductSurfaceTelemetry,
} from '../observability/product-surface-telemetry-context';
import type {
  ProductNavigationGroup as ProductAreaNavigationGroup,
  ProductNavigationItem as ProductAreaNavigationItem,
  ProductSurfaceManifest,
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
    | 'meetings'
    | 'messaging'
    | 'notifications'
    | 'spaces';
  navigation: readonly ProductAreaNavigationGroup[];
  manifest?: ProductSurfaceManifest;
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
    | 'meetings'
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
  manifest,
  translationNamespace = 'workforce',
  surface,
}: ProductAreaLayoutProps) {
  const { t } = useTranslation(translationNamespace);
  const { t: tCommon } = useTranslation('common');
  const { t: tAccount } = useTranslation('account');
  const { t: tShell } = useTranslation('shell');
  const { preference } = useAppearance();
  const shell = shellRegistry[areaKey];
  const productExperience = getProductExperienceProfile(areaKey);
  const AreaIcon = shell.context.icon;
  const auth = useAuth();
  const providerRole = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerRole);
  const supportSession = providerRole ? (supportContext.data ?? undefined) : undefined;
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const canAccessLegacyItem = (item: ProductAreaNavigationItem) =>
    permissionsLoaded &&
    (!providerRole || (!supportContext.isLoading && supportSession !== undefined)) &&
    canAccessProductAreaNavigationItem(
      item,
      hasPermission,
      providerRole ? supportSession?.scopes : undefined
    );
  const location = useLocation();
  const { pathname } = location;
  const mobileNavigation = useShellMobileNavigation({
    headerTestId: `${areaKey}-header`,
  });
  const mobileNavigationId = `${areaKey}-mobile-navigation`;
  const telemetry = useProductSurfaceTelemetry();
  const {
    compact,
    collapsible,
    desktopOffset,
    sidebarWidth,
    toggle: toggleDesktopNavigation,
  } = useDesktopNavigation(shell);
  const tenantName =
    supportSession?.tenantName ||
    auth.user?.tenantName ||
    auth.user?.tenantCode ||
    t('shell.tenantFallback');
  const legacyManifest = surface ? undefined : manifest;
  const legacyPresentation = legacyManifest
    ? buildLegacyProductSurfacePresentation({
        manifest: legacyManifest,
        pathname,
        navigation,
        canAccessItem: canAccessLegacyItem,
      })
    : undefined;
  const navigationSource = legacyManifest ? (legacyPresentation?.navigation ?? []) : navigation;
  const visibleNavigation = navigationSource
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (surface?.compatibilityNavigationTargets && isSurfaceNavigationItem(item)) {
          return surface.compatibilityNavigationTargets?.has(item.path) === true;
        }
        if (surface && isSurfaceNavigationItem(item)) {
          return canContextAccessNavigation(
            item.access,
            surface.decision.context,
            surface.decision.scope.key,
            surface.serverNowMs
          );
        }
        if (surface) return false;
        return canAccessLegacyItem(item);
      }),
    }))
    .filter((group) => group.items.length > 0);
  const returnTarget = supportSession
    ? { path: '/provider/support', label: tAccount('shell.backToProvider') }
    : surface?.returnTarget
      ? surface.returnTarget
      : legacyPresentation
        ? {
            path: legacyPresentation.returnTarget.path,
            label: tCommon(
              legacyPresentation.returnTarget.kind === 'work'
                ? 'productSurface.actions.returnToWork'
                : 'productSurface.actions.returnToCatalog'
            ),
          }
        : { path: '/', label: t('shell.backToHome') };
  const presentationPlane =
    surface?.decision.context.plane ?? legacyPresentation?.currentSurface.plane;
  const presentationLabel =
    surface?.label ??
    (legacyPresentation ? t(legacyPresentation.currentSurface.labelKey) : undefined);
  const presentationEntries = surface?.entryPoints ?? legacyPresentation?.headerEntryPoints;
  const currentSurfaceId =
    surface?.decision.context.surfaceKey ?? legacyPresentation?.currentSurface.id;
  const productLabel = t(`shell.${areaKey}.name`);
  const headerContextLabel =
    presentationPlane === 'management'
      ? tCommon('productSurface.labels.managementTitle', { product: productLabel })
      : productLabel;
  const SurfaceIcon = presentationPlane === 'management' ? Settings2 : AreaIcon;
  const contentInstanceKey = surface
    ? productSurfaceContentInstanceKey({
        contextKey: surface.decision.context.contextKey,
        surfaceKey: surface.decision.context.surfaceKey,
        contextScopeKey: surface.decision.scope.key,
        decisionRevision: surface.decision.decisionRevision,
      })
    : legacyPresentation
      ? `legacy:${legacyPresentation.currentSurface.id}`
      : 'legacy';
  const returnSurface = surface?.entryPoints?.find((entry) => entry.entryKind === 'work-return');
  const legacyReturnSurface = legacyPresentation?.headerEntryPoints.find(
    (entry) => entry.entryKind === 'work-return'
  );
  const compactWorkSurfaceRail = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const showMobileSurfaceContextRail = Boolean(
    currentSurfaceId &&
    presentationEntries &&
    (presentationPlane === 'management' ||
      (compactWorkSurfaceRail && presentationEntries.length > 1))
  );

  const navigationContent = (
    compactNavigation: boolean,
    onNavigate?: () => void,
    onDismiss?: () => void
  ) => (
    <Box sx={{ height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <DesktopNavigationHeader
        compact={compactNavigation}
        collapsible={collapsible}
        controlsId={`${areaKey}-desktop-navigation`}
        onDismiss={onDismiss}
        onToggle={toggleDesktopNavigation}
      />
      <Divider />
      <Box sx={{ px: 2.5, pt: 2.25, pb: 1, display: compactNavigation ? 'none' : 'block' }}>
        <Typography component="p" variant="overline" sx={{ color: 'var(--dwp-product-accent)' }}>
          {presentationLabel ?? t(`shell.${areaKey}.context`)}
        </Typography>
        <Typography variant="body2" fontWeight={750} noWrap>
          {tenantName}
        </Typography>
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
                const exactNavigationTarget = surface?.compatibilityNavigationTargets?.get(
                  item.path
                );
                return (
                  <Box component="li" key={item.path} sx={{ display: 'block' }}>
                    <Tooltip title={compactNavigation ? label : ''} placement="right">
                      <ListItemButton
                        data-testid={`${areaKey}-navigation-item-${item.view}`}
                        component={NavLink}
                        to={
                          exactNavigationTarget
                            ? resolveProductCompatibilityNavigationLocation(
                                item.path,
                                exactNavigationTarget,
                                location
                              )
                            : {
                                pathname: item.path,
                                search: surface ? location.search : '',
                                hash: surface ? location.hash : '',
                              }
                        }
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
                          '@media (forced-colors: active)': {
                            '&.Mui-selected': {
                              outline: '2px solid Highlight',
                              outlineOffset: -2,
                            },
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
            data-testid={`${areaKey}-surface-return`}
            component={NavLink}
            to={returnTarget.path}
            fullWidth
            intent="quiet"
            aria-label={compactNavigation ? returnTarget.label : undefined}
            startIcon={
              supportSession ? (
                <LifeBuoy size={17} strokeWidth={1.8} />
              ) : surface || legacyPresentation ? (
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
              } else if (legacyPresentation && legacyReturnSurface) {
                telemetry.captureReturn(
                  legacyManifest!.id,
                  legacyPresentation.currentSurface.id,
                  legacyReturnSurface.surfaceId
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
      data-product-surface-label={surface?.label}
      data-product-plane={presentationPlane}
      data-product-presentation={
        surface
          ? surface.compatibilityNavigation
            ? 'compatibility-separated'
            : 'native-surface'
          : legacyPresentation
            ? 'compatibility-separated'
            : undefined
      }
      data-dwp-navigation-state={compact ? 'compact' : 'expanded'}
      data-product-concept={productExperience.concept}
      data-product-density={productExperience.density}
      sx={(theme) => {
        const dark = theme.palette.mode === 'dark';
        const canvas =
          dark || preference.highContrast
            ? theme.palette.background.default
            : productExperience.canvas;
        const sidebar =
          dark || preference.highContrast
            ? theme.palette.background.paper
            : productExperience.sidebar;
        const tones = resolveProductExperienceTones(productExperience, {
          mode: theme.palette.mode,
          highContrast: preference.highContrast,
          canvas,
          sidebar,
        });

        return {
          minHeight: '100dvh',
          bgcolor: canvas,
          '--dwp-product-accent': tones.accent,
          '--dwp-product-secondary': tones.secondary,
          '--dwp-product-accent-border': alpha(tones.accent, dark ? 0.34 : 0.2),
          '--dwp-product-soft': dark
            ? alpha(tones.accent, PRODUCT_EXPERIENCE_SOFT_OPACITY)
            : productExperience.softSurface,
          '--dwp-product-canvas': canvas,
          '--dwp-product-sidebar': sidebar,
          '--dwp-product-selection': dark
            ? alpha(tones.accent, PRODUCT_EXPERIENCE_SELECTION_OPACITY)
            : productExperience.selection,
        };
      }}
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
        {navigationContent(compact)}
      </Box>
      <ShellMobileNavigationDrawer
        controlsId={mobileNavigationId}
        label={t(`shell.${areaKey}.navigationLabel`)}
        onDismiss={mobileNavigation.dismiss}
        open={mobileNavigation.open}
        testId={`${areaKey}-mobile-sidebar`}
        width={shell.desktopNavigationWidth}
      >
        <Box
          sx={(theme) => {
            const dark = theme.palette.mode === 'dark';
            const canvas =
              dark || preference.highContrast
                ? theme.palette.background.default
                : productExperience.canvas;
            const sidebar =
              dark || preference.highContrast
                ? theme.palette.background.paper
                : productExperience.sidebar;
            const tones = resolveProductExperienceTones(productExperience, {
              mode: theme.palette.mode,
              highContrast: preference.highContrast,
              canvas,
              sidebar,
            });

            return {
              height: 1,
              minHeight: 0,
              bgcolor: sidebar,
              '--dwp-product-accent': tones.accent,
              '--dwp-product-selection': dark
                ? alpha(tones.accent, PRODUCT_EXPERIENCE_SELECTION_OPACITY)
                : productExperience.selection,
            };
          }}
        >
          {navigationContent(false, mobileNavigation.navigate, mobileNavigation.dismiss)}
        </Box>
      </ShellMobileNavigationDrawer>
      <ShellHeader
        testId={`${areaKey}-header`}
        shellKey={shell.key}
        scope={supportSession ? 'support' : shell.scope}
        desktopOffset={desktopOffset}
        context={{
          icon: SurfaceIcon,
          label: headerContextLabel,
          detail: surface ? `${tenantName} · ${surface.decision.scope.displayName}` : undefined,
        }}
        navigation={{
          controlsId: mobileNavigationId,
          expanded: mobileNavigation.open,
          label:
            areaKey === 'work' || areaKey === 'activity'
              ? tShell('navigation.open')
              : t('shell.openNavigation'),
          testId: `${areaKey}-mobile-navigation-trigger`,
          onOpen: mobileNavigation.openFrom,
        }}
        showWorkspace={shell.showWorkspace && !supportSession}
        primaryNavigation={
          presentationEntries && currentSurfaceId ? (
            <Box data-testid={`${areaKey}-desktop-surface-switcher`}>
              <ProductSurfaceHeaderControls
                variant="desktop"
                currentSurfaceId={currentSurfaceId}
                entries={presentationEntries}
                label={tCommon('productSurface.labels.surfaceNavigation')}
                productLabel={productLabel}
                resolveLabel={(labelKey) => t(labelKey)}
              />
            </Box>
          ) : undefined
        }
        mobilePrimaryNavigation={
          !showMobileSurfaceContextRail && presentationEntries && currentSurfaceId ? (
            <Box data-testid={`${areaKey}-mobile-surface-switcher`}>
              <ProductSurfaceHeaderControls
                variant="compact"
                currentSurfaceId={currentSurfaceId}
                entries={presentationEntries}
                label={tCommon('productSurface.labels.surfaceNavigation')}
                productLabel={productLabel}
                resolveLabel={(labelKey) => t(labelKey)}
              />
            </Box>
          ) : undefined
        }
        mobileContextRail={
          showMobileSurfaceContextRail ? (
            <Box
              sx={{
                width: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
              }}
            >
              {presentationEntries && currentSurfaceId ? (
                <Box
                  data-testid={`${areaKey}-mobile-surface-switcher`}
                  sx={{ flex: '0 0 auto', minWidth: 0 }}
                >
                  <ProductSurfaceHeaderControls
                    variant="compact"
                    currentSurfaceId={currentSurfaceId}
                    entries={presentationEntries}
                    label={tCommon('productSurface.labels.surfaceNavigation')}
                    productLabel={productLabel}
                    resolveLabel={(labelKey) => t(labelKey)}
                  />
                </Box>
              ) : undefined}
              {presentationPlane === 'management' ? (
                surface ? (
                  <ProductSurfaceContextBarSlot
                    runtime={surface}
                    variant="mobile-rail"
                    tenantLabel={tenantName}
                  />
                ) : (
                  <Box
                    component="span"
                    data-testid="product-surface-compatibility-tenant"
                    title={tenantName}
                    sx={{
                      flex: '1 1 auto',
                      minWidth: 40,
                      ml: 0.5,
                      pl: 1,
                      overflow: 'hidden',
                      borderLeft: 1,
                      borderColor: 'divider',
                      color: 'text.secondary',
                      typography: 'caption',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {tenantName}
                  </Box>
                )
              ) : undefined}
            </Box>
          ) : undefined
        }
        contextControls={surface ? <ProductSurfaceContextBarSlot runtime={surface} /> : undefined}
        sx={
          presentationPlane === 'management'
            ? {
                boxShadow: 'inset 0 3px 0 var(--dwp-product-accent)',
                '@media (forced-colors: active)': {
                  boxShadow: 'none',
                  borderTop: '3px solid CanvasText',
                },
              }
            : undefined
        }
      />
      <Box
        component="main"
        id="dwp-main-content"
        tabIndex={-1}
        sx={{
          pt: showMobileSurfaceContextRail
            ? {
                xs: `${shellHeaderHeight + shellMobileContextRailHeight}px`,
                lg: `${shellHeaderHeight}px`,
              }
            : `${shellHeaderHeight}px`,
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
        {legacyPresentation && legacyManifest ? (
          <ProductSurfaceTelemetryExposure
            productKey={legacyManifest.id}
            surfaceKey={legacyPresentation.currentSurface.id as `${string}.${string}`}
          >
            <Outlet key={contentInstanceKey} />
          </ProductSurfaceTelemetryExposure>
        ) : (
          <Outlet key={contentInstanceKey} />
        )}
      </Box>
    </Box>
  );
}
