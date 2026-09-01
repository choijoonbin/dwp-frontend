import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getHomeExperience,
  getHomeDeviceLayouts,
  getHomePreference,
  getHomeViews,
  getHomeOverview,
  getNotificationSummaryByApp,
  getWorkspaceApps,
  launchWorkspaceApp,
  resolveHomeBackgroundUrl,
  createHomeCommandKey,
  useAuth,
  usePermissions,
  useToast,
  HttpError,
  HOME_PERSONALIZATION_V2_ENABLED,
  HOME_WIDGET_LIBRARY_ENABLED,
  isAppResourceEntitled,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { ClassicHome } from '../features/home/classic-home/classic-home';
import { classicHomeGovernedWidgets } from '../features/home/classic-home/classic-home-governed-widgets';
import { FlowHome } from '../features/home/flow-home/flow-home';
import { useHomeContributionModel } from '../features/home/flow-home/use-home-contribution-model';
import {
  applyFlowHomeSections,
  deriveFlowHomeSections,
  isFlowLegacyGeometryMigrationEligible,
  normalizeLegacyFlowHomeSections,
} from '../features/home/flow-home/flow-home-preference';
import { HomeItemGallery } from '../features/home/home-item-gallery';
import {
  homeGalleryRestorableCount,
  resolveHomeAppGalleryItems,
  resolveHomeWidgetGalleryItems,
} from '../features/home/home-item-gallery-model';
import { HomeEditorSafeArea } from '../features/home/home-editor-safe-area';
import { homeUserAccessFingerprint } from '../features/home/runtime/home-access-fingerprint';
import {
  resolveHomeDeviceClass,
  resolveHomePageCopy,
} from '../features/home/runtime/home-page-runtime-state';
import { HomePageStatePanel } from '../features/home/runtime/home-page-state-panel';
import { useHomePageGate } from '../features/home/runtime/use-home-page-gate';
import { resolveHomeOverviewQueryFailureState } from '../features/home/runtime/home-overview-query-state';
import {
  homeAuthorizedQueryData,
  homeQueryRetry,
  isHomeAuthorizationFailure,
} from '../features/home/flow-home/home-contribution-runtime-policy';
import { HomeFooter } from '../features/home/home-footer';
import {
  HOME_NOTIFICATION_BADGE_FRESHNESS_MS,
  useHomeAppsWithBadges,
} from '../features/home/home-app-badge-policy';
import { notificationQueryKeys } from '../features/notifications/integration-contract';
import { RecommendationUndoSnackbar } from '../features/home/recommendation-undo-snackbar';
import { WorkspaceComposerToolbar } from '../components/workspace-composer/workspace-composer-toolbar';
import {
  HOME_OVERVIEW_FRESHNESS_SECONDS,
  HOME_WIDGET_KEYS,
  defaultHomeWidgets,
  reconcileHomeWidgets,
  setHomeWidgetVisibility,
} from '../features/home/home-widget-registry';
import {
  governedHomeZone,
  reconcileHomeCompositionPolicy,
} from '../features/home/home-composition-policy';
import {
  commitHomeDraftEdit,
  commitHomeDraftReset,
  homeDraftChangeCount,
  isHomeDraftDirty,
  reapplyHomeDraft,
} from '../features/home/home-draft-history';
import { HomePreferenceConflictDialog } from '../features/home/home-preference-conflict-dialog';
import { applyHomeDeviceOverlay } from '../features/home-personalization/home-device-overlay';
import { LazyHomePersonalizationStudio } from '../features/home-personalization/home-personalization-studio-lazy';
import {
  createHomeEditConflictTarget,
  rebaseHomeEditSession,
  saveHomeEditSession,
  type HomeEditConflictTarget,
  type HomeEditSession,
  type HomeSaveMutation,
} from '../features/home/runtime/home-edit-session';
import { useHomeEditorSafety } from '../features/home/runtime/use-home-editor-safety';
import { useHomeEditorEntryFocus } from '../features/home/runtime/use-home-editor-entry-focus';
import { useHomeCurrentInstant } from '../features/home/runtime/use-home-current-instant';
import { useHomeDraftController } from '../features/home/runtime/use-home-draft-controller';
import { useHomeRecommendationFeedback } from '../features/home/runtime/use-home-recommendation-feedback';
import { resolveHomeTimeZone } from '../features/home/runtime/home-time-zone';
import { activeHomeStoreUsesViews } from '../features/home/runtime/home-store-capabilities';
import { HomeEditorGuards } from '../features/home/runtime/home-editor-guards';
import {
  resolveHomeViewCustomized,
  resolvePendingHomeSaveCommand,
} from '../features/home-personalization/home-view-bootstrap';
import {
  canonicalizePersistedLaunchpadLayout,
  createDefaultLaunchpadLayout,
  localizeHomeApps,
  mergeEntitledLaunchpadProjection,
  placeLaunchpadApp,
  reconcileLaunchpadLayout,
  resolveHomeLaunchpadCatalog,
} from '../components/workspace-composer/app-launchpad-model';
import { useSystemCodeOptions } from '../components/use-system-code-options';
import { useGovernedHomeAppCatalog } from '../features/shell/use-governed-home-app-catalog';

import type { FlowHomeSectionPreference } from '../features/home/flow-home/flow-home-preference';
import type { HomeDraft } from '../features/home/home-draft-history';
export default function HomePage() {
  const { t, i18n } = useTranslation('home');
  const auth = useAuth();
  const theme = useTheme();
  const runtimeMobile = useMediaQuery(theme.breakpoints.down('md'));
  const toast = useToast();
  const { hasPermission, permissions } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(searchParams.get('edit') === 'home');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const openStudioFromGallery = () => {
    setGalleryOpen(false);
    setStudioOpen(true);
  };
  const [discardEditorOpen, setDiscardEditorOpen] = useState(false);
  const [editBaseDraft, setEditBaseDraft] = useState<HomeDraft | null>(null);
  const [editSession, setEditSession] = useState<HomeEditSession | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [conflictTarget, setConflictTarget] = useState<HomeEditConflictTarget | null>(null);
  const currentInstant = useHomeCurrentInstant();
  const editEntryFocusRef = useRef<HTMLElement | null>(null);
  const editEntryScrollRef = useRef(0);
  const conflictResolutionRef = useRef<'reload' | 'reapply' | null>(null);
  const pendingHomeSaveCommandRef = useRef<ReturnType<typeof resolvePendingHomeSaveCommand> | null>(
    null
  );
  const registeredWidgetKeys = useSystemCodeOptions('PLATFORM.HOME_WIDGET', HOME_WIDGET_KEYS);
  const closeEditor = useCallback(() => {
    pendingHomeSaveCommandRef.current = null;
    setGalleryOpen(false);
    setDiscardEditorOpen(false);
    setEditorOpen(false);
    setEditBaseDraft(null);
    setEditSession(null);
    setConflictTarget(null);
    conflictResolutionRef.current = null;
    setPreviewDevice('desktop');
    if (searchParams.get('edit') === 'home') {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const retainedEntry = editEntryFocusRef.current;
        const fallbackEntry = document.querySelector<HTMLElement>('[data-home-edit-trigger]');
        const target = retainedEntry?.isConnected ? retainedEntry : fallbackEntry;
        target?.focus({ preventScroll: true });
      });
    });
  }, [searchParams, setSearchParams]);
  const firstName = auth.user?.displayName?.split(' ')[0];
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
  const launchpadCatalog = useMemo(
    () =>
      resolveHomeLaunchpadCatalog(
        localizeHomeApps(t),
        homeExperienceQuery.data?.launchpadConfiguration,
        i18n.resolvedLanguage || i18n.language || 'en',
        t
      ),
    [homeExperienceQuery.data?.launchpadConfiguration, i18n.language, i18n.resolvedLanguage, t]
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
  const entitledApps = useGovernedHomeAppCatalog(entitledAppsWithBadges);
  const {
    draftHistory,
    setDraftHistory,
    setDraftWidgets,
    setDraftAppLayout,
    setDraftPresentation,
    replaceDraft,
    undoDraft,
    redoDraft,
  } = useHomeDraftController(() => ({
    widgets: defaultHomeWidgets(registeredWidgetKeys),
    appLayout: createDefaultLaunchpadLayout(entitledApps, launchpadCatalog.groups),
    presentation: 'balanced',
    resetIntent: false,
  }));
  const draftWidgets = draftHistory.present.widgets;
  const draftAppLayout = draftHistory.present.appLayout;
  const draftPresentation = draftHistory.present.presentation;
  const workspaceAppsQuery = useQuery({
    queryKey: ['workspace', 'apps'],
    queryFn: getWorkspaceApps,
    staleTime: 60_000,
    retry: 1,
  });
  const homeExperience = homeExperienceQuery.data;
  const flowHomeEnabled = homeExperience?.effectiveExperienceVariant === 'FLOW_V1';
  const advancedPersonalizationEnabled = Boolean(
    HOME_PERSONALIZATION_V2_ENABLED &&
    flowHomeEnabled &&
    homeExperience?.advancedPersonalizationEnabled
  );
  const composerEnabled = Boolean(
    advancedPersonalizationEnabled && homeExperience?.composerEnabled
  );
  const viewStoreEnabled = Boolean(
    advancedPersonalizationEnabled && homeExperience?.homePreferenceStore === 'VIEWS'
  );
  const activeStoreUsesViews = activeHomeStoreUsesViews(viewStoreEnabled, editSession?.store);
  const homeStudioEnabled = advancedPersonalizationEnabled && activeStoreUsesViews;
  const homePreferenceQuery = useQuery({
    queryKey: ['home-preference', auth.user?.tenantId, auth.user?.userId],
    queryFn: getHomePreference,
    enabled: homeExperienceQuery.isSuccess && !activeStoreUsesViews,
    staleTime: 5 * 60 * 1000,
    retry: homeQueryRetry,
  });
  const homeViewsQuery = useQuery({
    queryKey: ['home-personalization', 'views', 'workspace-home'],
    queryFn: () => getHomeViews('workspace-home'),
    enabled: homeExperienceQuery.isSuccess && activeStoreUsesViews,
    staleTime: 30_000,
    retry: homeQueryRetry,
  });
  const compositionPolicy = useMemo(
    () => reconcileHomeCompositionPolicy(homeExperience?.compositionPolicy),
    [homeExperience?.compositionPolicy]
  );
  const announcementsZone = governedHomeZone(compositionPolicy, 'announcements');
  const personalCustomizationEnabled =
    homeExperienceQuery.isSuccess && compositionPolicy.personalCustomizationEnabled;
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
  const audienceProfile = homeOverview?.audience.profile ?? 'MEMBER';
  const homeContributionRuntime = useHomeContributionModel({
    tenantId: auth.user?.tenantId,
    userId: auth.user?.userId,
    audience: audienceProfile,
    now: currentInstant,
    locale: i18n.resolvedLanguage || i18n.language || 'en',
    timeZone,
    permissions,
    roles: auth.user?.roles ?? [],
    legacyRoleFallbackAllowed: auth.user?.legacyRoleFallbackAllowed === true,
    accessFingerprint,
    overview: homeOverview,
    overviewLoading: homeOverviewQuery.isLoading,
    overviewFailed: homeOverviewQuery.isError && !homeOverview,
    overviewRefreshFailed: homeOverviewQuery.isRefetchError,
    notification: {
      data: notificationSummaryQuery.data,
      loading: notificationSummaryQuery.isLoading,
      fetching: notificationSummaryQuery.isFetching,
      failed: notificationSummaryQuery.isError,
      refreshFailed: notificationSummaryQuery.isRefetchError,
      error: notificationSummaryQuery.error,
    },
  });
  const widgetPreferences = useMemo(
    () =>
      homeCustomized && effectiveHomeLayout
        ? reconcileHomeWidgets(effectiveHomeLayout.widgets, registeredWidgetKeys, audienceProfile)
        : defaultHomeWidgets(registeredWidgetKeys, audienceProfile),
    [audienceProfile, effectiveHomeLayout, homeCustomized, registeredWidgetKeys]
  );
  const deviceClass = resolveHomeDeviceClass({
    editPreviewActive: editorOpen && editSession !== null,
    previewDevice,
    runtimeMobile,
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
        launchpadCatalog.apps,
        launchpadCatalog.groups
      ),
    [effectiveHomeLayout?.appLayout, launchpadCatalog.apps, launchpadCatalog.groups]
  );
  const appLayout = useMemo(
    () => reconcileLaunchpadLayout(canonicalAppLayout, entitledApps, launchpadCatalog.groups),
    [canonicalAppLayout, entitledApps, launchpadCatalog.groups]
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
    experienceQuery: homeExperienceQuery,
    layoutQuery: activeStoreUsesViews ? homeViewsQuery : homePreferenceQuery,
    deviceLayoutPending:
      activeStoreUsesViews && Boolean(sourceHomeView) && homeDeviceLayoutsQuery.isPending,
    customizationEnabled: personalCustomizationEnabled,
    editorOpen,
  });
  const currentEditSession = useMemo<HomeEditSession>(
    () => ({
      experienceVariant: flowHomeEnabled ? 'FLOW_V1' : 'CLASSIC',
      store: viewStoreEnabled ? 'VIEWS' : 'LEGACY',
      viewId: viewStoreEnabled ? (selectedHomeView?.viewId ?? null) : null,
      viewName: viewStoreEnabled ? (selectedHomeView?.name ?? null) : null,
      version: persistedVersion,
      resetAvailable: durableResetAvailable,
    }),
    [
      durableResetAvailable,
      flowHomeEnabled,
      persistedVersion,
      selectedHomeView?.name,
      selectedHomeView?.viewId,
      viewStoreEnabled,
    ]
  );
  const editorFlowHomeEnabled =
    editorOpen && editSession ? editSession.experienceVariant === 'FLOW_V1' : flowHomeEnabled;
  const editorActive = editorOpen && editSession !== null;
  const editorResetAvailable =
    editorActive && editSession ? editSession.resetAvailable : durableResetAvailable;
  const editorSourceFailed = homeExperienceQuery.isError || persistedSourceFailed;
  const persistedDraft = useMemo<HomeDraft>(
    () => ({
      appLayout,
      widgets: widgetPreferences,
      presentation: effectiveHomeLayout?.presentation ?? 'balanced',
      resetIntent: false,
    }),
    [appLayout, effectiveHomeLayout?.presentation, widgetPreferences]
  );
  const activeAppLayout = editorActive ? draftAppLayout : appLayout;
  const activeWidgets = editorActive ? draftWidgets : runtimeWidgetPreferences;
  const restorableHomeItemCount = useMemo(
    () =>
      homeGalleryRestorableCount([
        ...resolveHomeAppGalleryItems(entitledApps, activeAppLayout),
        ...resolveHomeWidgetGalleryItems(
          registeredWidgetKeys,
          activeWidgets,
          entitledApps,
          editorFlowHomeEnabled
        ),
      ]),
    [activeAppLayout, activeWidgets, editorFlowHomeEnabled, entitledApps, registeredWidgetKeys]
  );
  const activePresentation = editorActive
    ? draftPresentation
    : (effectiveHomeLayout?.presentation ?? 'balanced');
  const legacyFlowGeometryMigrationEligible = isFlowLegacyGeometryMigrationEligible(
    sourceHomeView?.schemaVersion ?? homePreference?.schemaVersion,
    sourceHomeView?.updatedAt ?? homePreference?.updatedAt
  );
  const flowSections = useMemo(
    () =>
      normalizeLegacyFlowHomeSections(
        deriveFlowHomeSections(
          activeWidgets,
          editorActive || homeCustomized,
          editorActive ? undefined : activeDeviceOverlay?.widgetSizes
        ),
        legacyFlowGeometryMigrationEligible
      ),
    [
      activeDeviceOverlay?.widgetSizes,
      activeWidgets,
      editorActive,
      homeCustomized,
      legacyFlowGeometryMigrationEligible,
    ]
  );
  const draftDirty = Boolean(
    editorActive && editBaseDraft && isHomeDraftDirty(editBaseDraft, draftHistory.present)
  );
  const draftChangeCount = editBaseDraft
    ? homeDraftChangeCount(editBaseDraft, draftHistory.present)
    : 0;
  useHomeEditorEntryFocus(editorActive);
  const initialEditingDraft = useMemo<HomeDraft>(() => {
    if (!editorFlowHomeEnabled) return persistedDraft;
    const canonicalSections = normalizeLegacyFlowHomeSections(
      deriveFlowHomeSections(persistedDraft.widgets, homeCustomized),
      legacyFlowGeometryMigrationEligible
    );
    return {
      ...persistedDraft,
      widgets: applyFlowHomeSections(persistedDraft.widgets, canonicalSections),
    };
  }, [editorFlowHomeEnabled, homeCustomized, legacyFlowGeometryMigrationEligible, persistedDraft]);
  useEffect(() => {
    if (homeExperienceQuery.isSuccess && !personalCustomizationEnabled && editorOpen) {
      closeEditor();
      return;
    }
    if (!editorOpen) {
      replaceDraft(persistedDraft);
      return;
    }
    if (editSession === null) {
      if (homeExperienceQuery.isError || persistedSourceFailed) {
        closeEditor();
        return;
      }
      if (!homeExperienceQuery.isSuccess || persistedSourceLoading) return;
      replaceDraft(initialEditingDraft);
      setEditBaseDraft(initialEditingDraft);
      setEditSession(currentEditSession);
      return;
    }
    const conflictResolution = conflictResolutionRef.current;
    if (conflictResolution) {
      if (conflictResolution === 'reload') {
        replaceDraft(initialEditingDraft);
      }
      setEditBaseDraft(initialEditingDraft);
      conflictResolutionRef.current = null;
    }
  }, [
    closeEditor,
    currentEditSession,
    editSession,
    editorOpen,
    homeExperienceQuery.isError,
    persistedSourceLoading,
    persistedSourceFailed,
    homeExperienceQuery.isSuccess,
    initialEditingDraft,
    personalCustomizationEnabled,
    persistedDraft,
    persistedVersion,
    replaceDraft,
  ]);
  const beginEditing = () => {
    if (
      persistedSourceLoading ||
      persistedSourceFailed ||
      !homeExperienceQuery.isSuccess ||
      !personalCustomizationEnabled
    ) {
      return;
    }
    editEntryFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editEntryScrollRef.current = document.scrollingElement?.scrollTop ?? window.scrollY;
    replaceDraft(initialEditingDraft);
    setEditBaseDraft(initialEditingDraft);
    setEditSession(currentEditSession);
    setEditorOpen(true);
    if (searchParams.get('edit') !== 'home') {
      const next = new URLSearchParams(searchParams);
      next.set('edit', 'home');
      setSearchParams(next, { replace: true });
    }
  };
  const cancelEditing = useCallback(() => {
    replaceDraft(persistedDraft);
    closeEditor();
    window.requestAnimationFrame(() => window.scrollTo({ top: editEntryScrollRef.current }));
  }, [closeEditor, persistedDraft, replaceDraft]);
  const requestCancelEditing = useCallback(() => {
    if (draftDirty) {
      setDiscardEditorOpen(true);
      return;
    }
    cancelEditing();
  }, [cancelEditing, draftDirty]);
  const navigationBlocker = useHomeEditorSafety({
    editorOpen,
    draftDirty,
    overlayOpen: galleryOpen || studioOpen || conflictTarget !== null || discardEditorOpen,
    onRequestCancel: requestCancelEditing,
  });
  useEffect(() => {
    if (!editorOpen || !draftDirty) return undefined;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [draftDirty, editorOpen]);
  const preferenceMutation = useMutation({
    mutationFn: (request: HomeSaveMutation) =>
      saveHomeEditSession(request, t('page.defaultHomeName')),
    onSuccess: async (result) => {
      pendingHomeSaveCommandRef.current = null;
      if (result.store === 'VIEWS') {
        queryClient.setQueryData<typeof homeViewsQuery.data>(
          ['home-personalization', 'views', 'workspace-home'],
          (current) =>
            current?.map((view) => (view.viewId === result.view.viewId ? result.view : view)) ?? [
              result.view,
            ]
        );
      } else {
        queryClient.setQueryData(
          ['home-preference', auth.user?.tenantId, auth.user?.userId],
          result.preference
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
        queryClient.invalidateQueries({ queryKey: ['home-personalization', 'device-layouts'] }),
        queryClient.invalidateQueries({ queryKey: ['home-personalization', 'revisions'] }),
        queryClient.invalidateQueries({
          queryKey: ['home-personalization', 'views', 'workspace-home'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['home-preference', auth.user?.tenantId, auth.user?.userId],
        }),
      ]);
      closeEditor();
      toast.success(t('page.homeSaved'));
    },
    onError: async (error, request) => {
      if (error instanceof HttpError && error.status === 409) {
        pendingHomeSaveCommandRef.current = null;
        if (request.session.store === 'VIEWS') {
          const latest = await homeViewsQuery.refetch();
          const target = request.session.viewId
            ? latest.data?.find((view) => view.viewId === request.session.viewId)
            : (latest.data?.find((view) => view.isDefault) ?? latest.data?.[0]);
          const nextConflict = createHomeEditConflictTarget(request.session, target);
          if (!nextConflict) {
            toast.error(t('page.saveError'));
            return;
          }
          setConflictTarget(nextConflict);
        } else {
          const latest = await homePreferenceQuery.refetch();
          setConflictTarget(createHomeEditConflictTarget(request.session, latest.data));
        }
        toast.error(t('flow.conflict.toast'));
        return;
      }
      toast.error(t('page.saveError'));
    },
  });
  const appLaunchMutation = useMutation({
    mutationFn: launchWorkspaceApp,
    onSuccess: async (launch) => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] });
      if (launch.launchMode === 'NATIVE') navigate(launch.launchTarget);
      else window.open(launch.launchTarget, '_blank', 'noopener,noreferrer');
    },
    onError: () => toast.error(t('page.appLaunchError')),
  });
  const customizationBusy = persistedSourceLoading || preferenceMutation.isPending;
  const reloadLatestAfterConflict = () => {
    conflictResolutionRef.current = 'reload';
    setEditSession((current) =>
      current && conflictTarget ? rebaseHomeEditSession(current, conflictTarget) : current
    );
    setConflictTarget(null);
  };

  const reapplyAfterConflict = () => {
    conflictResolutionRef.current = 'reapply';
    if (editBaseDraft) {
      replaceDraft(
        reapplyHomeDraft(editBaseDraft, draftHistory.present, initialEditingDraft, entitledApps)
      );
    }
    setEditSession((current) =>
      current && conflictTarget ? rebaseHomeEditSession(current, conflictTarget) : current
    );
    setConflictTarget(null);
  };

  const saveHome = () => {
    if (!draftDirty || !editSession || !editBaseDraft || editorSourceFailed) return;
    const reset = draftHistory.present.resetIntent;
    const layout = {
      appLayout: reset
        ? createDefaultLaunchpadLayout(launchpadCatalog.apps, launchpadCatalog.groups)
        : mergeEntitledLaunchpadProjection(
            canonicalAppLayout,
            editBaseDraft.appLayout,
            draftAppLayout,
            entitledApps
          ),
      presentation: draftPresentation,
      widgets: draftWidgets,
    };
    const command = resolvePendingHomeSaveCommand(
      pendingHomeSaveCommandRef.current,
      layout,
      () => createHomeCommandKey(reset ? 'reset-home-view' : 'save-home-view'),
      reset
    );
    pendingHomeSaveCommandRef.current = command;
    preferenceMutation.mutate({
      layout,
      idempotencyKey: command.idempotencyKey,
      reset,
      session: editSession,
    });
  };

  const resetDraft = () => {
    const defaultWidgets = defaultHomeWidgets(registeredWidgetKeys, audienceProfile);
    const resetWidgets = editorFlowHomeEnabled
      ? applyFlowHomeSections(defaultWidgets, deriveFlowHomeSections(defaultWidgets, false))
      : defaultWidgets;
    setDraftHistory((current) => {
      const next: HomeDraft = {
        appLayout: createDefaultLaunchpadLayout(entitledApps, launchpadCatalog.groups),
        widgets: resetWidgets,
        presentation: 'balanced',
        resetIntent: editorResetAvailable,
      };
      return editorResetAvailable
        ? commitHomeDraftReset(current, next)
        : commitHomeDraftEdit(current, next);
    });
  };
  const updateFlowSections = (sections: FlowHomeSectionPreference[]) => {
    setDraftWidgets((current) => applyFlowHomeSections(current, sections));
  };
  const launcherSummaryPartial =
    hasPermission('APP.NOTIFICATIONS', 'VIEW') &&
    !notificationAuthorizationFailed &&
    (notificationSummaryQuery.isError ||
      notificationSummaryQuery.isRefetchError ||
      Boolean(notificationSummaryQuery.data?.partial));
  const { hardFailed: homeOverviewHardFailed, refreshPartial: homeOverviewRefreshPartial } =
    resolveHomeOverviewQueryFailureState({
      hasData: Boolean(homeOverview),
      isError: homeOverviewQuery.isError,
      isRefetchError: homeOverviewQuery.isRefetchError,
    });
  const retryHomeData = () => {
    void Promise.all([
      homeOverviewQuery.refetch(),
      ...(hasPermission('APP.NOTIFICATIONS', 'VIEW') ? [notificationSummaryQuery.refetch()] : []),
      homeContributionRuntime.retry(),
    ]);
  };

  const backgroundUrl = resolveHomeBackgroundUrl(homeExperience);
  const currentDate = formatDate(currentInstant, { dateStyle: 'full' });
  const workQueue = homeOverview?.work.data;
  const workspaceUpdatedAt =
    workQueue?.generatedAt || homeOverview?.generatedAt
      ? formatDate(new Date(workQueue?.generatedAt || homeOverview!.generatedAt), {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';
  const runtimeAppById = new Map((workspaceAppsQuery.data ?? []).map((app) => [app.id, app]));
  const launchApp = (app: (typeof entitledApps)[number]) => {
    if (app.managementOnly && app.managementRoute) {
      navigate(app.managementRoute);
      return;
    }
    const runtimeApp = runtimeAppById.get(app.id);
    if (!runtimeApp) {
      navigate(app.route);
      return;
    }
    if (runtimeApp.health === 'configuration-required') {
      navigate(`/apps?app=${encodeURIComponent(runtimeApp.id)}`);
      return;
    }
    appLaunchMutation.mutate(runtimeApp.id);
  };
  const governedCanvasWidgets = classicHomeGovernedWidgets({
    zone: announcementsZone,
    label: t('widgets.registry.announcements.label'),
    overview: homeOverview,
    loading: homeOverviewQuery.isLoading,
    fetching: homeOverviewQuery.isFetching,
    requestFailed: homeOverviewHardFailed,
    onRetry: () => void homeOverviewQuery.refetch(),
  });
  const { headline: homeHeadline, subheadline: homeSubheadline } = resolveHomePageCopy({
    experience: homeExperience,
    locale: i18n.resolvedLanguage || i18n.language || '',
    fallbackHeadline: firstName ? t('page.welcomeName', { name: firstName }) : t('page.welcome'),
    fallbackSubheadline: t('page.commandDescription'),
  });
  const homeAssistantAvailable = !editorOpen && isAppResourceEntitled('APP.ASK', permissions);

  return (
    <Box
      data-home-assistant-rail={homeAssistantAvailable ? 'header' : 'none'}
      sx={{
        minHeight: 0,
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        '& > footer': { mt: 'auto' },
      }}
    >
      {homePageGate.state.kind !== 'ready' ? (
        <HomePageStatePanel
          state={homePageGate.state}
          retrying={homePageGate.retrying}
          onRetry={homePageGate.retry}
        />
      ) : editorFlowHomeEnabled ? (
        <FlowHome
          audience={audienceProfile}
          now={currentInstant}
          currentDate={currentDate}
          headline={homeHeadline}
          subheadline={homeSubheadline}
          updatedAt={workspaceUpdatedAt}
          timeZone={timeZone}
          backgroundUrl={backgroundUrl}
          backgroundPosition={homeExperience?.backgroundPosition ?? 'RIGHT'}
          focalX={homeExperience?.backgroundFocalX}
          focalY={homeExperience?.backgroundFocalY}
          mobileFocalX={homeExperience?.mobileBackgroundFocalX}
          mobileFocalY={homeExperience?.mobileBackgroundFocalY}
          contentAlignment={homeExperience?.contentAlignment}
          overlayOpacity={homeExperience?.overlayOpacity ?? 18}
          apps={entitledApps}
          appGroups={launchpadCatalog.groups}
          appLayout={activeAppLayout}
          sections={flowSections}
          widgetConfigurations={activeWidgetConfigurations}
          overview={homeOverview}
          overviewLoading={homeOverviewQuery.isLoading}
          overviewFetching={homeOverviewQuery.isFetching}
          overviewFailed={homeOverviewHardFailed}
          supplementalPartial={homeOverviewRefreshPartial || homeContributionRuntime.partial}
          notificationPartial={launcherSummaryPartial}
          contributionModel={homeContributionRuntime.model}
          contributionLoading={homeContributionRuntime.loading}
          contributionFetching={homeContributionRuntime.fetching}
          contributionPartial={homeContributionRuntime.partial}
          announcementsPolicy={announcementsZone}
          editing={editorActive}
          customizationEnabled={personalCustomizationEnabled}
          customizationBusy={customizationBusy}
          presentation={activePresentation}
          density={activeDeviceOverlay?.density ?? 'comfortable'}
          previewDevice={previewDevice}
          feedbackBusy={recommendationFeedback.busy}
          onBrowseAllApps={() => navigate('/apps')}
          onStartEditing={homePageGate.editActionAvailable ? beginEditing : undefined}
          onOpenStudio={homeStudioEnabled && !editorOpen ? () => setStudioOpen(true) : undefined}
          onAppLayoutChange={setDraftAppLayout}
          onSectionsChange={updateFlowSections}
          onLaunchApp={launchApp}
          onManageApp={(app) => {
            if (app.managementRoute) navigate(app.managementRoute);
          }}
          onRetryOverview={retryHomeData}
          onRetryContributions={retryHomeData}
          onRecommendationFeedback={recommendationFeedback.dismiss}
        />
      ) : (
        <ClassicHome
          audience={audienceProfile}
          currentDate={currentDate}
          headline={homeHeadline}
          subheadline={homeSubheadline}
          backgroundUrl={backgroundUrl}
          usesDefaultBackground={!homeExperience?.backgroundUrl}
          backgroundPosition={homeExperience?.backgroundPosition ?? 'RIGHT'}
          overlayOpacity={homeExperience?.overlayOpacity ?? 18}
          apps={entitledApps}
          appGroups={launchpadCatalog.groups}
          appLayout={activeAppLayout}
          widgets={activeWidgets}
          governedWidgets={governedCanvasWidgets}
          overview={homeOverview}
          overviewLoading={homeOverviewQuery.isLoading}
          overviewFetching={homeOverviewQuery.isFetching}
          overviewFailed={homeOverviewHardFailed}
          editing={editorActive}
          customizationEnabled={personalCustomizationEnabled}
          customizationBusy={customizationBusy}
          personalizationLoading={homePreferenceQuery.isLoading}
          presentation={activePresentation}
          feedbackBusy={recommendationFeedback.busy}
          onBrowseAllApps={() => navigate('/apps')}
          onStartEditing={homePageGate.editActionAvailable ? beginEditing : undefined}
          onAppLayoutChange={setDraftAppLayout}
          onWidgetsChange={setDraftWidgets}
          onLaunchApp={launchApp}
          onManageApp={(app) => {
            if (app.managementRoute) navigate(app.managementRoute);
          }}
          onRetryOverview={() => void homeOverviewQuery.refetch()}
          onRecommendationFeedback={recommendationFeedback.dismiss}
        />
      )}

      <HomeFooter updatedAt={workspaceUpdatedAt} />

      {editorActive && editorFlowHomeEnabled && <HomeEditorSafeArea />}

      <HomeItemGallery
        open={galleryOpen}
        availableApps={entitledApps}
        appLayout={activeAppLayout}
        availableWidgetKeys={registeredWidgetKeys}
        widgetPreferences={activeWidgets}
        catalogEnabled={HOME_WIDGET_LIBRARY_ENABLED}
        flow={editorFlowHomeEnabled}
        busy={customizationBusy}
        onClose={() => setGalleryOpen(false)}
        onAddApp={(app) => setDraftAppLayout((current) => placeLaunchpadApp(current, app))}
        onAddWidget={(widgetKey) =>
          setDraftWidgets((current) => setHomeWidgetVisibility(current, widgetKey, true))
        }
        onOpenStudio={homeStudioEnabled ? openStudioFromGallery : undefined}
      />
      {editorActive && personalCustomizationEnabled && (
        <WorkspaceComposerToolbar
          placement="floating"
          widePresentation={editorFlowHomeEnabled}
          presentation={draftPresentation}
          busy={customizationBusy}
          addLabel={t(
            HOME_WIDGET_LIBRARY_ENABLED ? 'editor.addItems' : 'editor.restoreHiddenItems'
          )}
          addUnavailableReason={
            !HOME_WIDGET_LIBRARY_ENABLED && restorableHomeItemCount === 0
              ? t('editor.noHiddenItemsAvailable')
              : undefined
          }
          onPresentationChange={setDraftPresentation}
          onAdd={() => setGalleryOpen(true)}
          onReset={resetDraft}
          onCancel={requestCancelEditing}
          onDone={saveHome}
          canUndo={draftHistory.past.length > 0}
          canRedo={draftHistory.future.length > 0}
          canReset={editorResetAvailable || draftDirty}
          canSave={draftDirty && !editorSourceFailed}
          dirtyCount={draftChangeCount}
          previewDevice={editorFlowHomeEnabled ? previewDevice : undefined}
          onUndo={undoDraft}
          onRedo={redoDraft}
          onPreviewDeviceChange={editorFlowHomeEnabled ? setPreviewDevice : undefined}
        />
      )}
      <HomePreferenceConflictDialog
        open={conflictTarget !== null}
        changeCount={draftChangeCount}
        latestVersion={conflictTarget?.version}
        busy={homePreferenceQuery.isFetching || homeViewsQuery.isFetching}
        onReloadLatest={reloadLatestAfterConflict}
        onReapply={reapplyAfterConflict}
        onClose={() => setConflictTarget(null)}
      />
      <HomeEditorGuards
        discardOpen={discardEditorOpen}
        navigationBlocked={navigationBlocker.state === 'blocked'}
        onKeepDraft={() => setDiscardEditorOpen(false)}
        onDiscardDraft={cancelEditing}
        onStayOnHome={() => navigationBlocker.reset?.()}
        onLeaveHome={() => navigationBlocker.proceed?.()}
      />
      {homeStudioEnabled && (
        <Suspense fallback={null}>
          <LazyHomePersonalizationStudio
            open={studioOpen}
            composerEnabled={composerEnabled}
            seedLayout={effectiveHomeLayout ?? null}
            onClose={() => setStudioOpen(false)}
            onEditView={() => beginEditing()}
          />
        </Suspense>
      )}

      <RecommendationUndoSnackbar
        open={Boolean(recommendationFeedback.hidden)}
        busy={recommendationFeedback.undoBusy}
        onClose={recommendationFeedback.clear}
        onUndo={recommendationFeedback.undo}
      />
    </Box>
  );
}
