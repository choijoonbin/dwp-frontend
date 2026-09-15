import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  HOME_PERSONALIZATION_V2_ENABLED,
  getHomeDeviceLayouts,
  getHomeExperience,
  getHomeOverview,
  getHomePreference,
  getHomeViews,
  getNotificationSummaryByApp,
  getWorkspaceApps,
  type HomeExperienceVariant,
} from '@dwp-frontend/shared-utils';

import { homeViewQueryKey } from '../../components/home-view-query-key';
import {
  canonicalizePersistedLaunchpadLayout,
  filterHomeAppsByWorkspaceCatalog,
  localizeHomeApps,
  reconcileLaunchpadLayout,
  resolveHomeLaunchpadCatalog,
} from '../../components/workspace-composer/app-launchpad-model';
import {
  HOME_NOTIFICATION_BADGE_FRESHNESS_MS,
  useHomeAppsWithBadges,
} from '../../features/home/home-app-badge-policy';
import {
  governedHomeZone,
  reconcileHomeCompositionPolicy,
} from '../../features/home/home-composition-policy';
import {
  HOME_OVERVIEW_FRESHNESS_SECONDS,
  reconcileHomeWidgets,
  defaultHomeWidgets,
} from '../../features/home/home-widget-registry';
import { useHomeContributionModel } from '../../features/home/flow-home/use-home-contribution-model';
import {
  homeAuthorizedQueryData,
  homeQueryRetry,
  isHomeAuthorizationFailure,
} from '../../features/home/flow-home/home-contribution-runtime-policy';
import { applyHomeDeviceOverlay } from '../../features/home-personalization/home-device-overlay';
import { resolveHomeViewCustomized } from '../../features/home-personalization/home-view-bootstrap';
import { notificationQueryKeys } from '../../features/notifications/integration-contract';
import { useGovernedHomeAppCatalog } from '../../features/shell/use-governed-home-app-catalog';
import { homeUserAccessFingerprint } from '../../features/home/runtime/home-access-fingerprint';
import { resolveHomeDeviceClass } from '../../features/home/runtime/home-page-runtime-state';
import { useHomePageGate } from '../../features/home/runtime/use-home-page-gate';
import { useHomeRecommendationFeedback } from '../../features/home/runtime/use-home-recommendation-feedback';
import { resolveHomeTimeZone } from '../../features/home/runtime/home-time-zone';
import { useHomeWidgetRegistryRuntime } from '../../features/home/runtime/use-home-widget-registry';
import { activeHomeStoreUsesViews } from '../../features/home/runtime/home-store-capabilities';

import type { HomeEditSession } from '../../features/home/runtime/home-edit-session';
import type { useAuth, usePermissions } from '@dwp-frontend/shared-utils';

type HomeIdentity = ReturnType<typeof useAuth>;
type HomePermissionContext = ReturnType<typeof usePermissions>;

type HomeCoreReadModelOptions = Readonly<{
  auth: HomeIdentity;
  permissions: HomePermissionContext['permissions'];
  hasPermission: HomePermissionContext['hasPermission'];
  currentInstant: Date;
  locale: string;
  translate: Parameters<typeof localizeHomeApps>[0];
}>;

export function useHomeCoreReadModel({
  auth,
  permissions,
  hasPermission,
  currentInstant,
  locale,
  translate,
}: HomeCoreReadModelOptions) {
  const timeZone = useMemo(resolveHomeTimeZone, []);
  const accessFingerprint = homeUserAccessFingerprint(permissions, auth.user);
  const homeOverviewQueryKey = [
    'home-overview',
    auth.user?.tenantId,
    auth.user?.userId,
    timeZone,
    accessFingerprint,
  ] as const;
  const homeOverviewQuery = useQuery({
    queryKey: homeOverviewQueryKey,
    queryFn: () => getHomeOverview(timeZone),
    staleTime: HOME_OVERVIEW_FRESHNESS_SECONDS * 1000,
    refetchInterval: HOME_OVERVIEW_FRESHNESS_SECONDS * 1000,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });
  const homeOverview = homeAuthorizedQueryData(homeOverviewQuery.data, homeOverviewQuery.error);
  const recommendationFeedback = useHomeRecommendationFeedback(homeOverviewQueryKey);
  const notificationSummaryQuery = useQuery({
    queryKey: notificationQueryKeys.appSummary({
      tenantId: auth.user?.tenantId,
      userId: auth.user?.userId,
      accessFingerprint,
    }),
    queryFn: ({ signal }) => getNotificationSummaryByApp(signal),
    enabled: Boolean(
      auth.user?.tenantId && auth.user?.userId && hasPermission('APP.NOTIFICATIONS', 'VIEW')
    ),
    staleTime: HOME_NOTIFICATION_BADGE_FRESHNESS_MS,
    refetchInterval: HOME_NOTIFICATION_BADGE_FRESHNESS_MS,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });
  const notificationAuthorizationFailed = isHomeAuthorizationFailure(
    notificationSummaryQuery.error
  );
  const notificationSummary = homeAuthorizedQueryData(
    notificationSummaryQuery.data,
    notificationSummaryQuery.error
  );
  const homeExperienceQuery = useQuery({
    queryKey: ['home-experience', auth.user?.tenantId],
    queryFn: getHomeExperience,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const workspaceAppsQuery = useQuery({
    queryKey: ['workspace', 'apps'],
    queryFn: getWorkspaceApps,
    staleTime: 60_000,
    retry: 1,
  });
  const { decisions: widgetRuntimeDecisions, shadowObservation: widgetShadowObservation } =
    useHomeWidgetRegistryRuntime(auth.user?.tenantId, auth.user?.userId);
  const launchpadCatalog = useMemo(
    () =>
      resolveHomeLaunchpadCatalog(
        localizeHomeApps(translate),
        homeExperienceQuery.data?.launchpadConfiguration,
        locale,
        translate
      ),
    [homeExperienceQuery.data?.launchpadConfiguration, locale, translate]
  );
  const notificationSummaryAuthorized = hasPermission('APP.NOTIFICATIONS', 'VIEW');
  const entitledAppsWithBadges = useHomeAppsWithBadges({
    apps: launchpadCatalog.apps,
    roles: auth.user?.roles ?? [],
    permissions,
    legacyRoleFallbackAllowed: auth.user?.legacyRoleFallbackAllowed === true,
    notificationSummary,
    notificationSummaryAuthorized,
    notificationSummaryHealthy:
      notificationSummaryAuthorized &&
      notificationSummaryQuery.isSuccess &&
      !notificationSummaryQuery.isError &&
      !notificationSummaryQuery.isRefetchError,
    notificationSummaryNow: currentInstant,
  });
  const governedEntitledApps = useGovernedHomeAppCatalog(entitledAppsWithBadges);
  const entitledApps = useMemo(
    () => filterHomeAppsByWorkspaceCatalog(governedEntitledApps, workspaceAppsQuery.data),
    [governedEntitledApps, workspaceAppsQuery.data]
  );

  return {
    accessFingerprint,
    entitledApps,
    homeExperienceQuery,
    homeOverview,
    homeOverviewQuery,
    launchpadCatalog,
    notificationAuthorizationFailed,
    notificationSummaryAuthorized,
    notificationSummaryQuery,
    recommendationFeedback,
    timeZone,
    widgetRuntimeDecisions,
    widgetShadowObservation,
    workspaceAppsQuery,
  } as const;
}

type HomePersonalizationReadModelOptions = Readonly<{
  activeHomeViewScope: Readonly<{
    modeKey: HomeExperienceVariant;
    modeScoped: boolean;
  }>;
  auth: HomeIdentity;
  availableWidth: number;
  core: ReturnType<typeof useHomeCoreReadModel>;
  currentInstant: Date;
  editSession: HomeEditSession | null;
  editorOpen: boolean;
  homeModeKey: HomeExperienceVariant;
  locale: string;
  modeScopedHomeViewsSupported: boolean;
  permissions: HomePermissionContext['permissions'];
  previewDevice: 'desktop' | 'mobile';
  registeredWidgetKeys: Parameters<typeof defaultHomeWidgets>[0];
  viewStoreEnabled: boolean;
}>;

export function useHomePersonalizationReadModel({
  activeHomeViewScope,
  auth,
  availableWidth,
  core,
  currentInstant,
  editSession,
  editorOpen,
  homeModeKey,
  locale,
  modeScopedHomeViewsSupported,
  permissions,
  previewDevice,
  registeredWidgetKeys,
  viewStoreEnabled,
}: HomePersonalizationReadModelOptions) {
  const homeExperience = core.homeExperienceQuery.data;
  const flowHomeEnabled = homeModeKey === 'FLOW_V1';
  const activeHomeViewQueryKey = useMemo(
    () =>
      homeViewQueryKey({
        tenantId: auth.user?.tenantId,
        userId: auth.user?.userId,
        surfaceKey: 'workspace-home',
        modeKey: activeHomeViewScope.modeKey,
        modeScoped: activeHomeViewScope.modeScoped,
      }),
    [
      activeHomeViewScope.modeKey,
      activeHomeViewScope.modeScoped,
      auth.user?.tenantId,
      auth.user?.userId,
    ]
  );
  const advancedPersonalizationEnabled = Boolean(
    HOME_PERSONALIZATION_V2_ENABLED && homeExperience?.advancedPersonalizationEnabled
  );
  const composerEnabled = Boolean(
    advancedPersonalizationEnabled && homeExperience?.composerEnabled
  );
  const activeStoreUsesViews = activeHomeStoreUsesViews(viewStoreEnabled, editSession?.store);
  const homeStudioEnabled = advancedPersonalizationEnabled && activeStoreUsesViews;
  const homePreferenceQuery = useQuery({
    queryKey: ['home-preference', auth.user?.tenantId, auth.user?.userId],
    queryFn: getHomePreference,
    enabled: core.homeExperienceQuery.isSuccess && !activeStoreUsesViews,
    staleTime: 5 * 60 * 1000,
    retry: homeQueryRetry,
  });
  const homeViewsQuery = useQuery({
    queryKey: activeHomeViewQueryKey,
    queryFn: () =>
      getHomeViews('workspace-home', activeHomeViewScope.modeKey, activeHomeViewScope.modeScoped),
    enabled: core.homeExperienceQuery.isSuccess && activeStoreUsesViews,
    staleTime: 30_000,
    retry: homeQueryRetry,
  });
  const compositionPolicy = useMemo(
    () => reconcileHomeCompositionPolicy(homeExperience?.compositionPolicy),
    [homeExperience?.compositionPolicy]
  );
  const announcementsZone = governedHomeZone(compositionPolicy, 'announcements');
  const personalCustomizationEnabled =
    core.homeExperienceQuery.isSuccess && compositionPolicy.personalCustomizationEnabled;
  const homePreference = homePreferenceQuery.data;
  const selectedHomeView = useMemo(
    () => homeViewsQuery.data?.find((view) => view.isDefault) ?? homeViewsQuery.data?.[0] ?? null,
    [homeViewsQuery.data]
  );
  const editSessionHomeView = useMemo(() => {
    if (editSession?.store !== 'VIEWS' || !editSession.viewId) return null;
    return homeViewsQuery.data?.find((view) => view.viewId === editSession.viewId) ?? null;
  }, [editSession?.store, editSession?.viewId, homeViewsQuery.data]);
  const sourceHomeView = activeStoreUsesViews
    ? editorOpen && editSession?.store === 'VIEWS'
      ? editSessionHomeView
      : selectedHomeView
    : null;
  const homeDeviceLayoutsQuery = useQuery({
    queryKey: ['home-personalization', 'device-layouts', sourceHomeView?.viewId],
    queryFn: () => getHomeDeviceLayouts(sourceHomeView!.viewId),
    enabled: activeStoreUsesViews && Boolean(sourceHomeView),
    staleTime: 30_000,
    retry: 1,
  });
  const effectiveHomeLayout =
    activeStoreUsesViews && sourceHomeView ? sourceHomeView.layout : homePreference?.layout;
  const homeCustomized = resolveHomeViewCustomized(
    activeStoreUsesViews ? sourceHomeView : null,
    activeStoreUsesViews ? undefined : homePreference?.customized
  );
  const durableResetAvailable = activeStoreUsesViews
    ? Boolean(sourceHomeView && homeCustomized)
    : Boolean(homePreference && homeCustomized);
  const audienceProfile = core.homeOverview?.audience.profile ?? 'MEMBER';
  const homeContributionRuntime = useHomeContributionModel({
    tenantId: auth.user?.tenantId,
    userId: auth.user?.userId,
    audience: audienceProfile,
    now: currentInstant,
    locale,
    timeZone: core.timeZone,
    permissions,
    roles: auth.user?.roles ?? [],
    legacyRoleFallbackAllowed: auth.user?.legacyRoleFallbackAllowed === true,
    accessFingerprint: core.accessFingerprint,
    overview: core.homeOverview,
    overviewLoading: core.homeOverviewQuery.isLoading,
    overviewFailed: core.homeOverviewQuery.isError && !core.homeOverview,
    overviewRefreshFailed: core.homeOverviewQuery.isRefetchError,
    notification: {
      data: core.notificationSummaryQuery.data,
      loading: core.notificationSummaryQuery.isLoading,
      fetching: core.notificationSummaryQuery.isFetching,
      failed: core.notificationSummaryQuery.isError,
      refreshFailed: core.notificationSummaryQuery.isRefetchError,
      error: core.notificationSummaryQuery.error,
    },
  });
  const widgetPreferences = useMemo(
    () =>
      homeCustomized && effectiveHomeLayout
        ? reconcileHomeWidgets(
            effectiveHomeLayout.widgets,
            registeredWidgetKeys,
            audienceProfile,
            core.widgetRuntimeDecisions
          )
        : defaultHomeWidgets(registeredWidgetKeys, audienceProfile, core.widgetRuntimeDecisions),
    [
      audienceProfile,
      core.widgetRuntimeDecisions,
      effectiveHomeLayout,
      homeCustomized,
      registeredWidgetKeys,
    ]
  );
  const deviceClass = resolveHomeDeviceClass({
    editPreviewActive: editorOpen && editSession !== null,
    previewDevice,
    availableWidth,
  });
  const activeDeviceOverlay = activeStoreUsesViews
    ? homeDeviceLayoutsQuery.data?.find((layout) => layout.deviceClass === deviceClass)?.overlay
    : undefined;
  const activeWidgetConfigurations =
    activeStoreUsesViews && sourceHomeView ? sourceHomeView.widgetConfigurations : {};
  const runtimeWidgetPreferences = useMemo(
    () => applyHomeDeviceOverlay(widgetPreferences, activeDeviceOverlay),
    [activeDeviceOverlay, widgetPreferences]
  );
  const canonicalAppLayout = useMemo(
    () =>
      canonicalizePersistedLaunchpadLayout(
        effectiveHomeLayout?.appLayout,
        core.launchpadCatalog.apps,
        core.launchpadCatalog.groups
      ),
    [effectiveHomeLayout?.appLayout, core.launchpadCatalog.apps, core.launchpadCatalog.groups]
  );
  const appLayout = useMemo(
    () =>
      reconcileLaunchpadLayout(canonicalAppLayout, core.entitledApps, core.launchpadCatalog.groups),
    [canonicalAppLayout, core.entitledApps, core.launchpadCatalog.groups]
  );
  const preferenceVersion = homePreference?.version ?? 0;
  const persistedVersion =
    activeStoreUsesViews && sourceHomeView ? sourceHomeView.version : preferenceVersion;
  const persistedSourceLoading = activeStoreUsesViews
    ? homeViewsQuery.isLoading
    : homePreferenceQuery.isLoading;
  const persistedSourceFailed = activeStoreUsesViews
    ? homeViewsQuery.isError
    : homePreferenceQuery.isError;
  const homePageGate = useHomePageGate({
    experienceQuery: core.homeExperienceQuery,
    layoutQuery: activeStoreUsesViews ? homeViewsQuery : homePreferenceQuery,
    deviceLayoutPending:
      activeStoreUsesViews && Boolean(sourceHomeView) && homeDeviceLayoutsQuery.isPending,
    customizationEnabled: personalCustomizationEnabled,
    editorOpen,
  });
  const currentEditSession = useMemo<HomeEditSession>(
    () => ({
      experienceVariant: homeModeKey,
      modeScopedViews: modeScopedHomeViewsSupported,
      store: viewStoreEnabled ? 'VIEWS' : 'LEGACY',
      viewId: viewStoreEnabled ? (selectedHomeView?.viewId ?? null) : null,
      viewName: viewStoreEnabled ? (selectedHomeView?.name ?? null) : null,
      version: persistedVersion,
      resetAvailable: durableResetAvailable,
    }),
    [
      durableResetAvailable,
      homeModeKey,
      modeScopedHomeViewsSupported,
      persistedVersion,
      selectedHomeView?.name,
      selectedHomeView?.viewId,
      viewStoreEnabled,
    ]
  );

  return {
    activeDeviceOverlay,
    activeHomeViewQueryKey,
    activeStoreUsesViews,
    activeWidgetConfigurations,
    advancedPersonalizationEnabled,
    announcementsZone,
    appLayout,
    audienceProfile,
    canonicalAppLayout,
    composerEnabled,
    currentEditSession,
    deviceClass,
    durableResetAvailable,
    effectiveHomeLayout,
    flowHomeEnabled,
    homeContributionRuntime,
    homeCustomized,
    homeDeviceLayoutsQuery,
    homePageGate,
    homePreference,
    homePreferenceQuery,
    homeStudioEnabled,
    homeViewsQuery,
    personalCustomizationEnabled,
    persistedSourceFailed,
    persistedSourceLoading,
    persistedVersion,
    runtimeWidgetPreferences,
    selectedHomeView,
    sourceHomeView,
    widgetPreferences,
  } as const;
}
