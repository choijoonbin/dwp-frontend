import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronDown, ChevronRight, Home, LifeBuoy, Settings2 } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppearance } from '@dwp-frontend/design-system/appearance';
import {
  PRODUCT_EXPERIENCE_SELECTION_OPACITY,
  PRODUCT_EXPERIENCE_SOFT_OPACITY,
  resolveProductExperienceTones,
} from '@dwp-frontend/design-system/foundation/product-experience-tokens';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isExplicitAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
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
import {
  clearProductSurfaceFocusAfterNavigation,
  clearProductSurfaceFocus,
  deferProductSurfaceFocusClear,
  recordProductSurfaceFocus,
  synchronizeProductSurfaceFocus,
} from '../components/product-surface-focus-handoff';
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
import {
  normalizeProductPath,
  resolveProductNavigationSelection,
} from '../components/product-manifest';
import { canAccessProductAreaNavigationItem } from './product-area-permissions';
import { ProductAreaMobileContextRail } from './product-area-mobile-context-rail';
import {
  isProductAreaSurfaceNavigationItem,
  resolveProductAreaParentAriaCurrent,
  type ProductAreaLayoutProps,
  type ProductAreaNavigationItem,
} from './product-area-layout-contract';
import {
  ProductAreaDesktopTaskNavigator,
  ProductAreaMobileTaskNavigator,
  ProductAreaNavigationReturnAction,
  taskNavigatorContextKey as contextKey,
  useProductAreaNavigationLocationResolver,
  useProductAreaTaskNavigator,
  useProductAreaTaskNavigatorLifecycle,
} from './product-area-task-navigator';

export * from './product-area-layout-contract';

export function ProductAreaLayout({
  areaKey,
  navigation,
  manifest,
  translationNamespace = 'workforce',
  surface,
  shellNavigationProjection,
  canAccessLegacySurface,
  renderNavigationItemChildren,
  navigationChildrenPresentation = 'disclosure',
  mobileSurfaceNavigation = 'header',
  resolveMobileShell,
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
  const { hasPermission, isLoaded: permissionsLoaded, permissions } = usePermissions();
  const canAccessLegacyItem = (item: ProductAreaNavigationItem) =>
    permissionsLoaded &&
    (!providerRole || (!supportContext.isLoading && supportSession !== undefined)) &&
    canAccessProductAreaNavigationItem(
      item,
      hasPermission,
      providerRole ? supportSession?.scopes : undefined
    );
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const navigationContextKey = contextKey(location, auth.user, supportSession, surface);
  const navigationDisclosureId = useId();
  const [collapsedNavigationPath, setCollapsedNavigationPath] = useState<string | null>(null);
  const taskNavigator = useProductAreaTaskNavigator();
  useEffect(() => setCollapsedNavigationPath(null), [navigationContextKey]);
  const mobileNavigation = useShellMobileNavigation({
    headerTestId: `${areaKey}-header`,
  });
  const mobileNavigationId = `${areaKey}-mobile-navigation`;
  const telemetry = useProductSurfaceTelemetry();
  const resolveChildNavigationLocation = useProductAreaNavigationLocationResolver(surface);
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
        canAccessSurface: (candidate) =>
          canAccessLegacySurface?.(candidate) ??
          (!candidate.entryAccess.requiresProductEntitlement ||
            isExplicitAppResourceEntitled(legacyManifest.appKey, permissions)),
      })
    : undefined;
  const authorizedShellPaths = new Set(
    surface
      ? [...(surface.compatibilityNavigationTargets?.keys() ?? [])].map(normalizeProductPath)
      : legacyPresentation
        ? [...legacyPresentation.navigationBySurfaceId.values()].flatMap((groups) =>
            groups.flatMap((group) => group.items.map((item) => normalizeProductPath(item.path)))
          )
        : []
  );
  const projectedShellNavigation = shellNavigationProjection
    ? shellNavigationProjection.project(authorizedShellPaths).flatMap((group) => {
        const items = group.items.flatMap((item) => {
          const path = normalizeProductPath(item.path);
          if (!authorizedShellPaths.has(path)) return [];
          return [
            {
              ...item,
              path,
              activePathPrefixes: item.activePathPrefixes
                ?.map(normalizeProductPath)
                .filter((activePath) => authorizedShellPaths.has(activePath)),
            },
          ];
        });
        return items.length ? [{ ...group, items }] : [];
      })
    : undefined;
  const navigationSource = shellNavigationProjection
    ? (projectedShellNavigation ?? [])
    : legacyManifest
      ? (legacyPresentation?.navigation ?? [])
      : navigation;
  const visibleNavigation = navigationSource
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (shellNavigationProjection) {
          return authorizedShellPaths.has(normalizeProductPath(item.path));
        }
        if (surface?.compatibilityNavigationTargets && isProductAreaSurfaceNavigationItem(item)) {
          return surface.compatibilityNavigationTargets?.has(item.path) === true;
        }
        if (surface && isProductAreaSurfaceNavigationItem(item)) {
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
  const presentationLabel = shellNavigationProjection
    ? undefined
    : (surface?.label ??
      (legacyPresentation ? t(legacyPresentation.currentSurface.labelKey) : undefined));
  const presentationEntries = shellNavigationProjection?.hideSurfaceNavigation
    ? undefined
    : (surface?.entryPoints ?? legacyPresentation?.headerEntryPoints);
  const currentSurfaceId =
    surface?.decision.context.surfaceKey ?? legacyPresentation?.currentSurface.id;
  const focusLocation = `${location.pathname}${location.search}${location.hash}`;
  const focusIdentityKey = `${auth.user?.identityPlane ?? 'anonymous'}:${auth.user?.tenantId ?? ''}:${auth.user?.userId ?? ''}`;
  const shellRef = useRef<HTMLDivElement>(null);
  const mobileNavigationTargetRef = useRef<{
    resolveTarget: () => HTMLElement | null;
    originLocation: string;
    expectedLocation?: string;
  } | null>(null);
  const focusLocationRef = useRef(focusLocation);
  const focusIdentityRef = useRef(focusIdentityKey);
  focusLocationRef.current = focusLocation;
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (focusIdentityRef.current !== focusIdentityKey) {
      clearProductSurfaceFocus();
      focusIdentityRef.current = focusIdentityKey;
    } else if (shell && (presentationPlane === 'work' || presentationPlane === 'management')) {
      synchronizeProductSurfaceFocus(shell, presentationPlane, focusIdentityKey, focusLocation);
    }
  }, [focusIdentityKey, focusLocation, presentationPlane]);
  useLayoutEffect(
    () => () => clearProductSurfaceFocusAfterNavigation(focusLocationRef.current),
    []
  );
  const recordSurfaceFocus = (event: FocusEvent<HTMLElement>) => {
    if (presentationPlane !== 'work' && presentationPlane !== 'management') return;
    if (event.target instanceof HTMLElement) {
      recordProductSurfaceFocus(
        event.currentTarget,
        event.target,
        presentationPlane,
        focusIdentityKey,
        focusLocation
      );
    }
  };
  const deferSurfaceFocusClear = (event: FocusEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement) {
      deferProductSurfaceFocusClear(event.currentTarget, event.target, event.relatedTarget);
    }
  };
  const dismissMobileNavigation = () => {
    mobileNavigationTargetRef.current = null;
    clearProductSurfaceFocus();
    mobileNavigation.dismiss();
  };
  const navigateMobileNavigation = () => {
    mobileNavigationTargetRef.current = null;
    clearProductSurfaceFocus();
    mobileNavigation.navigate();
  };
  const queueNavigationTarget = (
    resolveTarget: () => HTMLElement | null,
    expectedLocation?: string
  ) => {
    mobileNavigationTargetRef.current = {
      resolveTarget,
      originLocation: focusLocationRef.current,
      expectedLocation,
    };
    clearProductSurfaceFocus();
  };
  const navigateMobileNavigationToTarget = (
    resolveTarget: () => HTMLElement | null,
    expectedLocation?: string
  ) => {
    queueNavigationTarget(resolveTarget, expectedLocation);
    mobileNavigation.navigate();
  };
  const focusMobileNavigationTarget = useCallback(() => {
    const pendingTarget = mobileNavigationTargetRef.current;
    if (
      !pendingTarget ||
      (pendingTarget.expectedLocation
        ? pendingTarget.expectedLocation !== focusLocationRef.current
        : pendingTarget.originLocation === focusLocationRef.current)
    ) {
      return false;
    }
    const target = pendingTarget.resolveTarget();
    if (!target?.isConnected) return false;
    target.focus({ preventScroll: true });
    if (document.activeElement !== target) return false;
    mobileNavigationTargetRef.current = null;
    return true;
  }, []);
  useEffect(() => {
    const pendingTarget = mobileNavigationTargetRef.current;
    if (mobileNavigation.open || !pendingTarget) return undefined;
    let frame = 0;
    let remainingFrames = 120;
    const transferFocus = () => {
      if (focusMobileNavigationTarget() || !mobileNavigationTargetRef.current) return;
      remainingFrames -= 1;
      if (remainingFrames <= 0) {
        mobileNavigationTargetRef.current = null;
        return;
      }
      frame = window.requestAnimationFrame(transferFocus);
    };
    frame = window.requestAnimationFrame(transferFocus);
    return () => window.cancelAnimationFrame(frame);
  }, [focusLocation, focusMobileNavigationTarget, mobileNavigation.open, taskNavigator.path]);
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
  const compactSpecializedMobileShell = useMediaQuery('(max-width:1199.95px)', { noSsr: true });
  useProductAreaTaskNavigatorLifecycle({
    areaKey,
    compactShell: compactSpecializedMobileShell,
    contextKey: navigationContextKey,
    dismiss: taskNavigator.dismiss,
    path: taskNavigator.path,
  });
  const drawerSurfaceNavigation =
    mobileSurfaceNavigation === 'drawer' && presentationPlane === 'work';
  const showMobileSurfaceContextRail = Boolean(
    !drawerSurfaceNavigation &&
    currentSurfaceId &&
    presentationEntries &&
    (presentationPlane === 'management' ||
      (!resolveMobileShell && compactWorkSurfaceRail && presentationEntries.length > 1))
  );
  const specializedMobileShell = resolveMobileShell?.({
    pathname,
    search: location.search,
    visibleNavigationPaths: visibleNavigation.flatMap((group) =>
      group.items.map((item) => item.path)
    ),
    navigation: {
      controlsId: mobileNavigationId,
      expanded: mobileNavigation.open,
      label: t('shell.openNavigation'),
      testId: `${areaKey}-mobile-navigation-trigger`,
      onOpen: mobileNavigation.openFrom,
    },
    onNavigate: (path) => navigate(path),
  });
  const projectedSelectedView = shellNavigationProjection?.resolveSelectedView?.(pathname);
  const selectedNavigationItem = shellNavigationProjection?.resolveSelectedView
    ? undefined
    : resolveProductNavigationSelection(pathname, visibleNavigation);

  const navigationContent = (
    compactNavigation: boolean,
    onNavigate?: () => void,
    onDismiss?: () => void
  ) => {
    const openedPanelItem =
      navigationChildrenPresentation === 'panel' && taskNavigator.path
        ? visibleNavigation
            .flatMap((group) => group.items)
            .find((item) => item.path === taskNavigator.path)
        : undefined;
    const navigateFromPanel = () => {
      taskNavigator.dismiss(false);
      onNavigate?.();
    };
    const navigateFromPanelToTarget = (
      resolveTarget: () => HTMLElement | null,
      expectedLocation?: string
    ) => {
      taskNavigator.dismiss(false);
      if (onDismiss) {
        navigateMobileNavigationToTarget(resolveTarget, expectedLocation);
      } else {
        queueNavigationTarget(resolveTarget, expectedLocation);
      }
    };
    const openedPanelChildren = openedPanelItem
      ? renderNavigationItemChildren?.({
          item: openedPanelItem,
          selected: true,
          compact: Boolean(onDismiss),
          onNavigate: navigateFromPanel,
          onNavigateToTarget: navigateFromPanelToTarget,
          resolveNavigationLocation: resolveChildNavigationLocation,
        })
      : null;
    const openedPanelLabel = openedPanelItem
      ? t(`navigation.items.${areaKey}.${openedPanelItem.view}.label`)
      : undefined;
    const openedPanelId = openedPanelItem
      ? `${navigationDisclosureId}-${onDismiss ? 'mobile' : 'desktop'}-${openedPanelItem.view}`
      : undefined;

    if (onDismiss && openedPanelChildren && openedPanelLabel && openedPanelId) {
      return (
        <ProductAreaMobileTaskNavigator
          areaKey={areaKey}
          controlsId={openedPanelId}
          label={openedPanelLabel}
          onBack={() => taskNavigator.dismiss()}
          onDismiss={onDismiss}
        >
          {openedPanelChildren}
        </ProductAreaMobileTaskNavigator>
      );
    }

    return (
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
          <Typography variant="body2" fontWeight="fontWeightBold" noWrap>
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
                  const selected = shellNavigationProjection?.resolveSelectedView
                    ? projectedSelectedView === item.view
                    : selectedNavigationItem === item;
                  const label = t(`navigation.items.${areaKey}.${item.view}.label`);
                  const exactNavigationTarget = surface?.compatibilityNavigationTargets?.get(
                    item.path
                  );
                  const itemChildren =
                    !compactNavigation && navigationChildrenPresentation !== 'panel'
                      ? renderNavigationItemChildren?.({
                          item,
                          selected,
                          compact: compactNavigation,
                          onNavigate,
                          onNavigateToTarget: onDismiss
                            ? navigateMobileNavigationToTarget
                            : undefined,
                          resolveNavigationLocation: resolveChildNavigationLocation,
                        })
                      : null;
                  const panelCandidate =
                    navigationChildrenPresentation === 'panel'
                      ? renderNavigationItemChildren?.({
                          item,
                          selected: true,
                          compact: false,
                          resolveNavigationLocation: resolveChildNavigationLocation,
                        })
                      : null;
                  const panelChildren = Boolean(panelCandidate);
                  const panelOpen = panelChildren && taskNavigator.path === item.path;
                  const visuallyCurrent = selected && !panelOpen;
                  const disclosureChildren =
                    Boolean(itemChildren) && navigationChildrenPresentation === 'disclosure';
                  const inlineChildren =
                    Boolean(itemChildren) && navigationChildrenPresentation === 'inline';
                  const expanded =
                    Boolean(itemChildren) &&
                    (!disclosureChildren || collapsedNavigationPath !== item.path);
                  const childrenId = `${navigationDisclosureId}-${onDismiss ? 'mobile' : 'desktop'}-${item.view}`;
                  const DisclosureIcon = expanded ? ChevronDown : ChevronRight;
                  return (
                    <Box component="li" key={item.path} sx={{ display: 'block' }}>
                      <Tooltip title={compactNavigation ? label : ''} placement="right">
                        <ListItemButton
                          data-testid={`${areaKey}-navigation-item-${item.view}`}
                          component={
                            disclosureChildren || panelChildren
                              ? 'button'
                              : shellNavigationProjection?.resolveSelectedView
                                ? Link
                                : NavLink
                          }
                          type={disclosureChildren || panelChildren ? 'button' : undefined}
                          to={
                            disclosureChildren || panelChildren
                              ? undefined
                              : exactNavigationTarget
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
                          selected={visuallyCurrent}
                          aria-label={compactNavigation ? label : undefined}
                          aria-current={
                            panelChildren
                              ? selected && !panelOpen
                                ? 'page'
                                : undefined
                              : resolveProductAreaParentAriaCurrent({
                                  selected,
                                  pathname,
                                  item,
                                  hasInlineChildren: inlineChildren,
                                })
                          }
                          aria-expanded={
                            disclosureChildren ? expanded : panelChildren ? panelOpen : undefined
                          }
                          aria-controls={
                            disclosureChildren || panelChildren ? childrenId : undefined
                          }
                          data-navigation-panel-trigger={panelChildren ? 'true' : undefined}
                          data-navigation-panel-open={panelOpen ? 'true' : undefined}
                          data-navigation-route-current={selected ? 'true' : undefined}
                          onClick={
                            disclosureChildren
                              ? () => setCollapsedNavigationPath(expanded ? item.path : null)
                              : panelChildren
                                ? (event: MouseEvent<HTMLButtonElement>) => {
                                    taskNavigator.toggle(
                                      item.path,
                                      event.currentTarget as HTMLButtonElement
                                    );
                                  }
                                : onNavigate
                          }
                          sx={{
                            width: 1,
                            minHeight: 44,
                            justifyContent: compactNavigation ? 'center' : 'flex-start',
                            px: compactNavigation ? 1 : 1.25,
                            borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                            border: '1px solid transparent',
                            position: 'relative',
                            color:
                              visuallyCurrent || panelOpen
                                ? 'var(--dwp-product-accent)'
                                : 'text.secondary',
                            transition: (theme) =>
                              theme.transitions.create(
                                ['background-color', 'border-color', 'color', 'transform'],
                                { duration: theme.transitions.duration.shortest }
                              ),
                            '&[data-navigation-panel-open="true"]': {
                              color: 'var(--dwp-product-accent)',
                              bgcolor: 'var(--dwp-product-soft)',
                              borderColor: 'var(--dwp-product-accent-border)',
                              transform: compactNavigation ? undefined : 'translateX(2px)',
                            },
                            '&[data-navigation-panel-open="true"]:hover': {
                              bgcolor: 'var(--dwp-product-selection)',
                            },
                            '&.Mui-selected': { bgcolor: 'var(--dwp-product-selection)' },
                            '&.Mui-selected:hover': { bgcolor: 'var(--dwp-product-selection)' },
                            '&.Mui-selected::before': {
                              content: '""',
                              position: 'absolute',
                              inset: '8px auto 8px 0',
                              width: 3,
                              borderRadius: (theme) =>
                                `0 ${Number(theme.shape.borderRadius) * 0.5}px ${Number(theme.shape.borderRadius) * 0.5}px 0`,
                              bgcolor: 'var(--dwp-product-accent)',
                            },
                            '&.Mui-focusVisible': {
                              outline: '2px solid var(--dwp-product-accent)',
                              outlineOffset: 2,
                            },
                            '@media (prefers-reduced-motion: reduce)': {
                              transition: 'none',
                              transform: 'none',
                            },
                            '@media (forced-colors: active)': {
                              '&.Mui-selected': {
                                outline: '2px solid Highlight',
                                outlineOffset: -2,
                              },
                              '&[data-navigation-panel-open="true"]': {
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
                                fontWeight:
                                  visuallyCurrent || panelOpen
                                    ? 'fontWeightBold'
                                    : 'subtitle1.fontWeight',
                              }}
                            />
                          )}
                          {disclosureChildren && (
                            <DisclosureIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                          )}
                          {panelChildren && !compactNavigation && (
                            <Box
                              component="span"
                              sx={{
                                width: 24,
                                height: 24,
                                ml: 0.5,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                borderRadius: '50%',
                                bgcolor: panelOpen ? 'var(--dwp-product-selection)' : 'transparent',
                                transform: panelOpen ? 'rotate(180deg)' : undefined,
                                transition: 'transform 150ms ease',
                                '@media (prefers-reduced-motion: reduce)': {
                                  transition: 'none',
                                },
                              }}
                            >
                              <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                            </Box>
                          )}
                        </ListItemButton>
                      </Tooltip>
                      {itemChildren && (
                        <Box id={childrenId} hidden={!expanded}>
                          {expanded ? itemChildren : null}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </List>
            </Box>
          ))}
        </Box>
        {!onDismiss &&
        !compactSpecializedMobileShell &&
        openedPanelChildren &&
        openedPanelLabel &&
        openedPanelId ? (
          <ProductAreaDesktopTaskNavigator
            areaKey={areaKey}
            controlsId={openedPanelId}
            label={openedPanelLabel}
            left={sidebarWidth}
            onDismiss={(restoreFocus) => taskNavigator.dismiss(restoreFocus)}
          >
            {openedPanelChildren}
          </ProductAreaDesktopTaskNavigator>
        ) : null}
        <ProductAreaNavigationReturnAction
          compact={compactNavigation}
          label={returnTarget.label}
          testId={`${areaKey}-surface-return`}
          to={returnTarget.path}
          startIcon={
            supportSession ? (
              <LifeBuoy size={17} strokeWidth={1.8} />
            ) : surface || legacyPresentation ? (
              <ArrowLeft size={17} strokeWidth={1.8} />
            ) : (
              <Home size={17} strokeWidth={1.8} />
            )
          }
          onActivate={() => {
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
        />
      </Box>
    );
  };

  return (
    <Box
      ref={shellRef}
      onFocusCapture={recordSurfaceFocus}
      onBlurCapture={deferSurfaceFocusClear}
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
        onDismiss={dismissMobileNavigation}
        onExited={focusMobileNavigationTarget}
        open={mobileNavigation.open}
        testId={`${areaKey}-mobile-sidebar`}
        width={shell.desktopNavigationWidth}
      >
        <Box
          onFocusCapture={recordSurfaceFocus}
          onBlurCapture={deferSurfaceFocusClear}
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
              ...(drawerSurfaceNavigation ? { display: 'flex', flexDirection: 'column' } : {}),
              bgcolor: sidebar,
              '--dwp-product-accent': tones.accent,
              '--dwp-product-selection': dark
                ? alpha(tones.accent, PRODUCT_EXPERIENCE_SELECTION_OPACITY)
                : productExperience.selection,
            };
          }}
        >
          {drawerSurfaceNavigation && presentationEntries && currentSurfaceId ? (
            <>
              <Box
                data-testid={`${areaKey}-mobile-drawer-surface-switcher`}
                sx={{ px: 2, py: 1, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
              >
                <ProductSurfaceHeaderControls
                  variant="compact"
                  currentSurfaceId={currentSurfaceId}
                  entries={presentationEntries}
                  label={tCommon('productSurface.labels.surfaceNavigation')}
                  productLabel={productLabel}
                  resolveLabel={(labelKey) => t(labelKey)}
                  onNavigate={navigateMobileNavigation}
                />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                {navigationContent(false, navigateMobileNavigation, dismissMobileNavigation)}
              </Box>
            </>
          ) : (
            navigationContent(false, navigateMobileNavigation, dismissMobileNavigation)
          )}
        </Box>
      </ShellMobileNavigationDrawer>
      {compactSpecializedMobileShell && specializedMobileShell?.header ? (
        specializedMobileShell.header
      ) : (
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
            areaKey !== 'dwaion' &&
            !drawerSurfaceNavigation &&
            !showMobileSurfaceContextRail &&
            presentationEntries &&
            currentSurfaceId ? (
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
            showMobileSurfaceContextRail && presentationEntries && currentSurfaceId ? (
              <ProductAreaMobileContextRail
                areaKey={areaKey}
                currentSurfaceId={currentSurfaceId}
                entries={presentationEntries}
                label={tCommon('productSurface.labels.surfaceNavigation')}
                presentationPlane={presentationPlane}
                productLabel={productLabel}
                resolveLabel={(labelKey) => t(labelKey)}
                surface={surface}
                tenantName={tenantName}
              />
            ) : undefined
          }
          contextControls={surface ? <ProductSurfaceContextBarSlot runtime={surface} /> : undefined}
          sx={
            presentationPlane === 'management'
              ? {
                  boxShadow: (theme) => `inset 0 3px 0 ${theme.palette.primary.main}`,
                  '@media (forced-colors: active)': {
                    boxShadow: 'none',
                    borderTop: '3px solid CanvasText',
                  },
                }
              : undefined
          }
        />
      )}
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
          pb: specializedMobileShell?.footer
            ? { xs: 'calc(58px + env(safe-area-inset-bottom, 0px))', lg: 0 }
            : 0,
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
      {specializedMobileShell?.footer}
    </Box>
  );
}
