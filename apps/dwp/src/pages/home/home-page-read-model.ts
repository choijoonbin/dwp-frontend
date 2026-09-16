import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { homeDeviceClassForAvailableWidth } from '../../features/home/runtime/home-available-width';
import { resolveHomeDeviceClass } from '../../features/home/runtime/home-page-runtime-state';
import {
  homeV2ToExperience,
  homeV2ToNotificationSummary,
  homeV2ToOverview,
} from '../../features/home/runtime/home-v2-legacy-adapter';
import { useHomePageGate } from '../../features/home/runtime/use-home-page-gate';
import { useHomeRecommendationFeedback } from '../../features/home/runtime/use-home-recommendation-feedback';
import { resolveHomeTimeZone } from '../../features/home/runtime/home-time-zone';
import { useHomeV2Runtime } from '../../features/home/runtime/use-home-v2-runtime';
import { useHomeWidgetRegistryRuntime } from '../../features/home/runtime/use-home-widget-registry';
import { staticHomeWidgetRuntimeDecisions } from '../../features/home/runtime/widget-registry-runtime';
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
  availableWidth: number;
  locale: string;
  translate: Parameters<typeof localizeHomeApps>[0];
}>;

export function useHomeCoreReadModel({
  auth,
  permissions,
  hasPermission,
  currentInstant,
  availableWidth,
  locale,
  translate,
}: HomeCoreReadModelOptions) {
  const queryClient = useQueryClient();
  const timeZone = useMemo(resolveHomeTimeZone, []);
  const accessFingerprint = homeUserAccessFingerprint(permissions, auth.user);
  const requestedDeviceClass = homeDeviceClassForAvailableWidth(availableWidth);
  const homeV2Runtime = useHomeV2Runtime({
    accessFingerprint,
    deviceClass: requestedDeviceClass,
    enabled: true,
    tenantId: auth.user?.tenantId,
    timeZone,
    userId: auth.user?.userId,
  });
  const legacyEnabled = homeV2Runtime.legacyEnabled;
  const activeHomeV2Model =
    homeV2Runtime.activation.kind === 'ACTIVE'
      ? homeV2Runtime.activation.result.snapshot.data
      : null;
  useEffect(() => {
    if (!activeHomeV2Model) return;
    void Promise.all([
      queryClient.cancelQueries({ queryKey: ['home-overview'] }),
      queryClient.cancelQueries({ queryKey: ['home-experience'] }),
      queryClient.cancelQueries({ queryKey: ['workspace', 'apps'] }),
      queryClient.cancelQueries({ queryKey: ['widget-registry'] }),
      queryClient.cancelQueries({ queryKey: notificationQueryKeys.appSummaryRoot() }),
      queryClient.cancelQueries({ queryKey: ['home-contributions'] }),
      queryClient.cancelQueries({ queryKey: ['workspace', 'work-hub', 'home-personal'] }),
      queryClient.cancelQueries({ queryKey: ['workspace', 'work-hub', 'home-plan'] }),
      queryClient.cancelQueries({ queryKey: ['home-preference'] }),
      queryClient.cancelQueries({ queryKey: ['home-view'] }),
      queryClient.cancelQueries({ queryKey: ['home-personalization'] }),
      queryClient.cancelQueries({ queryKey: ['system-code-set', 'PLATFORM.HOME_WIDGET'] }),
    ]);
  }, [activeHomeV2Model, queryClient]);
  const homeOverviewQueryKey = [
    'home-overview',
    auth.user?.tenantId,
    auth.user?.userId,
    timeZone,
    accessFingerprint,
  ] as const;
  const legacyHomeOverviewQuery = useQuery({
    queryKey: homeOverviewQueryKey,
    queryFn: () => getHomeOverview(timeZone),
    enabled: legacyEnabled,
    staleTime: HOME_OVERVIEW_FRESHNESS_SECONDS * 1000,
    refetchInterval: HOME_OVERVIEW_FRESHNESS_SECONDS * 1000,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });
  const v2HomeOverview = useMemo(
    () => (activeHomeV2Model ? homeV2ToOverview(activeHomeV2Model) : undefined),
    [activeHomeV2Model]
  );
  const homeOverviewQuery = legacyEnabled
    ? legacyHomeOverviewQuery
    : {
        data: v2HomeOverview,
        error: homeV2Runtime.query.error,
        isError: homeV2Runtime.query.isError && !v2HomeOverview,
        isFetching: homeV2Runtime.query.isFetching,
        isLoading: homeV2Runtime.query.isPending,
        isPending: homeV2Runtime.query.isPending,
        isRefetchError: Boolean(v2HomeOverview && homeV2Runtime.query.isRefetchError),
        isSuccess: Boolean(v2HomeOverview),
        refetch: homeV2Runtime.query.refetch,
      };
  const homeOverview = legacyEnabled
    ? homeAuthorizedQueryData(legacyHomeOverviewQuery.data, legacyHomeOverviewQuery.error)
    : v2HomeOverview;
  const recommendationFeedback = useHomeRecommendationFeedback(homeOverviewQueryKey);
  const legacyNotificationSummaryQuery = useQuery({
    queryKey: notificationQueryKeys.appSummary({
      tenantId: auth.user?.tenantId,
      userId: auth.user?.userId,
      accessFingerprint,
    }),
    queryFn: ({ signal }) => getNotificationSummaryByApp(signal),
    enabled: Boolean(
      legacyEnabled &&
      auth.user?.tenantId &&
      auth.user?.userId &&
      hasPermission('APP.NOTIFICATIONS', 'VIEW')
    ),
    staleTime: HOME_NOTIFICATION_BADGE_FRESHNESS_MS,
    refetchInterval: HOME_NOTIFICATION_BADGE_FRESHNESS_MS,
    refetchIntervalInBackground: false,
    retry: homeQueryRetry,
  });
  const v2NotificationSummary = useMemo(
    () => (activeHomeV2Model ? homeV2ToNotificationSummary(activeHomeV2Model) : undefined),
    [activeHomeV2Model]
  );
  const notificationSummaryQuery = legacyEnabled
    ? legacyNotificationSummaryQuery
    : {
        data: v2NotificationSummary,
        error: homeV2Runtime.query.error,
        isError: homeV2Runtime.query.isError && !v2NotificationSummary,
        isFetching: homeV2Runtime.query.isFetching,
        isLoading: homeV2Runtime.query.isPending,
        isPending: homeV2Runtime.query.isPending,
        isRefetchError: Boolean(v2NotificationSummary && homeV2Runtime.query.isRefetchError),
        isSuccess: Boolean(v2NotificationSummary),
        refetch: homeV2Runtime.query.refetch,
      };
  const notificationAuthorizationFailed = isHomeAuthorizationFailure(
    notificationSummaryQuery.error
  );
  const notificationSummary = homeAuthorizedQueryData(
    notificationSummaryQuery.data,
    notificationSummaryQuery.error
  );
  const legacyHomeExperienceQuery = useQuery({
    queryKey: ['home-experience', auth.user?.tenantId],
    queryFn: getHomeExperience,
    enabled: legacyEnabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const v2HomeExperience = useMemo(
    () => (activeHomeV2Model ? homeV2ToExperience(activeHomeV2Model, locale) : undefined),
    [activeHomeV2Model, locale]
  );
  const homeExperienceQuery = legacyEnabled
    ? legacyHomeExperienceQuery
    : {
        data: v2HomeExperience,
        error: homeV2Runtime.query.error,
        isError: homeV2Runtime.query.isError && !v2HomeExperience,
        isFetching: homeV2Runtime.query.isFetching,
        isLoading: homeV2Runtime.query.isPending,
        isPending: homeV2Runtime.query.isPending,
        isRefetchError: Boolean(v2HomeExperience && homeV2Runtime.query.isRefetchError),
        isSuccess: Boolean(v2HomeExperience),
        refetch: homeV2Runtime.query.refetch,
      };
  const workspaceAppsQuery = useQuery({
    queryKey: ['workspace', 'apps'],
    queryFn: getWorkspaceApps,
    enabled: legacyEnabled,
    staleTime: 60_000,
    retry: 1,
  });
  const legacyWidgetRuntime = useHomeWidgetRegistryRuntime(
    auth.user?.tenantId,
    auth.user?.userId,
    legacyEnabled
  );
  const widgetRuntimeDecisions = activeHomeV2Model
    ? staticHomeWidgetRuntimeDecisions()
    : legacyWidgetRuntime.decisions;
  const widgetShadowObservation = activeHomeV2Model
    ? { status: 'INACTIVE' as const, mismatchCount: 0, decisionRevision: null, mismatches: [] }
    : legacyWidgetRuntime.shadowObservation;
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
  const routeGovernedApps = activeHomeV2Model ? entitledAppsWithBadges : governedEntitledApps;
  const entitledApps = useMemo(
    () =>
      filterHomeAppsByWorkspaceCatalog(
        routeGovernedApps,
        activeHomeV2Model ? undefined : workspaceAppsQuery.data
      ),
    [activeHomeV2Model, routeGovernedApps, workspaceAppsQuery.data]
  );

  return {
    accessFingerprint,
    entitledApps,
    homeExperienceQuery,
    homeV2Runtime,
    homeOverview,
    homeOverviewQuery,
    launchpadCatalog,
    notificationAuthorizationFailed,
    notificationSummaryAuthorized,
    notificationSummaryQuery,
    recommendationFeedback,
    timeZone,
    legacyEnabled,
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
  const activeHomeV2Model =
    core.homeV2Runtime.activation.kind === 'ACTIVE'
      ? core.homeV2Runtime.activation.result.snapshot.data
      : null;
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
    enabled: core.legacyEnabled && core.homeExperienceQuery.isSuccess && !activeStoreUsesViews,
    staleTime: 5 * 60 * 1000,
    retry: homeQueryRetry,
  });
  const homeViewsQuery = useQuery({
    queryKey: activeHomeViewQueryKey,
    queryFn: () =>
      getHomeViews('workspace-home', activeHomeViewScope.modeKey, activeHomeViewScope.modeScoped),
    enabled: core.legacyEnabled && core.homeExperienceQuery.isSuccess && activeStoreUsesViews,
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
    enabled: core.legacyEnabled && activeStoreUsesViews && Boolean(sourceHomeView),
    staleTime: 30_000,
    retry: 1,
  });
  const effectiveHomeLayout = activeHomeV2Model
    ? activeHomeV2Model.view.composition
    : activeStoreUsesViews && sourceHomeView
      ? sourceHomeView.layout
      : homePreference?.layout;
  const homeCustomized = activeHomeV2Model
    ? true
    : resolveHomeViewCustomized(
        activeStoreUsesViews ? sourceHomeView : null,
        activeStoreUsesViews ? undefined : homePreference?.customized
      );
  const durableResetAvailable = activeStoreUsesViews
    ? Boolean(sourceHomeView && homeCustomized)
    : Boolean(homePreference && homeCustomized);
  const audienceProfile = core.homeOverview?.audience.profile ?? 'MEMBER';
  const homeContributionRuntime = useHomeContributionModel({
    enabled: core.legacyEnabled,
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
  const activeDeviceOverlay = activeHomeV2Model
    ? (activeHomeV2Model.view.deviceOverlay ?? undefined)
    : activeStoreUsesViews
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
  const persistedSourceLoading = activeHomeV2Model
    ? false
    : activeStoreUsesViews
      ? homeViewsQuery.isLoading
      : homePreferenceQuery.isLoading;
  const persistedSourceFailed = activeHomeV2Model
    ? false
    : activeStoreUsesViews
      ? homeViewsQuery.isError
      : homePreferenceQuery.isError;
  const homePageGate = useHomePageGate({
    experienceQuery: core.homeExperienceQuery,
    layoutQuery: activeHomeV2Model
      ? core.homeV2Runtime.query
      : activeStoreUsesViews
        ? homeViewsQuery
        : homePreferenceQuery,
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
