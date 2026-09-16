import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  launchWorkspaceApp,
  resolveHomeBackgroundUrl,
  createHomeCommandKey,
  useAuth,
  usePermissions,
  useToast,
  HttpError,
  HOME_PERSONALIZATION_V2_ENABLED,
  HOME_CONTRACT_CAPABILITIES,
  HOME_WIDGET_LIBRARY_ENABLED,
  hasHomeContractCapability,
  isAppResourceEntitled,
  type HomeView,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import { ClassicHome } from '../features/home/classic-home/classic-home';
import { classicHomeGovernedWidgets } from '../features/home/classic-home/classic-home-governed-widgets';
import { FlowHome } from '../features/home/flow-home/flow-home';
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
import { homeViewQueryKey } from '../components/home-view-query-key';
import {
  resolveHomePageCopy,
  resolveHomeWorkspaceUpdatedAt,
} from '../features/home/runtime/home-page-runtime-state';
import { HomePageStatePanel } from '../features/home/runtime/home-page-state-panel';
import { useHomeAvailableWidth } from '../features/home/runtime/home-available-width';
import { resolveHomeOverviewQueryFailureState } from '../features/home/runtime/home-overview-query-state';
import { HomeFooter } from '../features/home/home-footer';
import { RecommendationUndoSnackbar } from '../features/home/recommendation-undo-snackbar';
import { WorkspaceComposerToolbar } from '../components/workspace-composer/workspace-composer-toolbar';
import {
  HOME_WIDGET_KEYS,
  defaultHomeWidgets,
  reconcileHomeWidgets,
  setHomeWidgetVisibility,
} from '../features/home/home-widget-registry';
import {
  commitHomeDraftEdit,
  commitHomeDraftReset,
  homeDraftChangeCount,
  isHomeDraftDirty,
  reapplyHomeDraft,
} from '../features/home/home-draft-history';
import { HomePreferenceConflictDialog } from '../components/home-preference-conflict-dialog';
import { LazyHomePersonalizationStudio } from '../features/home-personalization/home-personalization-studio-lazy';
import {
  createHomeEditConflictTarget,
  createHomeEditSessionFromView,
  rebaseHomeEditSession,
  saveHomeEditSession,
  type HomeEditConflictTarget,
  type HomeEditSession,
  type HomeSaveMutation,
} from '../features/home/runtime/home-edit-session';
import { useHomeEditorSafety } from '../features/home/runtime/use-home-editor-safety';
import { useHomeEditorEntryFocus } from '../features/home/runtime/use-home-editor-entry-focus';
import { useHomeCurrentInstant } from '../features/home/runtime/use-home-current-instant';
import { useHomeDataRetry } from '../features/home/runtime/use-home-data-retry';
import { useHomeDraftController } from '../features/home/runtime/use-home-draft-controller';
import {
  freezeHomeStudioContractScope,
  resolveActiveHomeViewScope,
  resolveBrokeredHomeExperience,
  type HomeStudioContractScope,
} from '../features/home/runtime/home-store-capabilities';
import { HomeEditorGuards } from '../features/home/runtime/home-editor-guards';
import {
  ActiveHomeOwnerWidgetRegion,
  homeV2RuntimeEvidence,
} from '../features/home/runtime/home-owner-widget-region';
import { createHomeAppLauncher } from '../features/home/runtime/home-app-launch';
import {
  resolveHomeViewCustomized,
  resolvePendingHomeSaveCommand,
} from '../features/home-personalization/home-view-bootstrap';
import {
  canonicalizePersistedLaunchpadLayout,
  createDefaultLaunchpadLayout,
  mergeEntitledLaunchpadProjection,
  placeLaunchpadApp,
  reconcileLaunchpadLayout,
} from '../components/workspace-composer/app-launchpad-model';
import { useSystemCodeOptions } from '../components/use-system-code-options';
import { useHomeCoreReadModel, useHomePersonalizationReadModel } from './home/home-page-read-model';
import { resolveWave2Evidence } from './home/home-wave2-evidence-adapter';
import type { FlowHomeSectionPreference } from '../features/home/flow-home/flow-home-preference';
import type { HomeDraft } from '../features/home/home-draft-history';
export default function HomePage() {
  const { t, i18n } = useTranslation('home');
  const auth = useAuth();
  const {
    elementRef: homeAvailableWidthRef,
    availableWidth: homeAvailableWidth,
    widthClass: homeAvailableWidthClass,
  } = useHomeAvailableWidth();
  const toast = useToast();
  const { hasPermission, permissions } = usePermissions();
  const navigate = useNavigate();
  const reportHomeMode = useOutletContext<((mode: 'CLASSIC' | 'FLOW_V1') => void) | null>();
  const [searchParams, setSearchParams] = useSearchParams();
  const wave2Evidence = resolveWave2Evidence(searchParams);
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(searchParams.get('edit') === 'home');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioContractScope, setStudioContractScope] = useState<HomeStudioContractScope | null>(
    null
  );
  const [discardEditorOpen, setDiscardEditorOpen] = useState(false);
  const [editBaseDraft, setEditBaseDraft] = useState<HomeDraft | null>(null);
  const [editSession, setEditSession] = useState<HomeEditSession | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [conflictTarget, setConflictTarget] = useState<HomeEditConflictTarget | null>(null);
  const currentInstant = useHomeCurrentInstant();
  const editEntryFocusRef = useRef<HTMLElement | null>(null);
  const studioEntryFocusRef = useRef<HTMLElement | null>(null);
  const studioFocusRestorePendingRef = useRef(false);
  const editEntryScrollRef = useRef(0);
  const conflictResolutionRef = useRef<'reload' | 'reapply' | null>(null);
  const pendingHomeSaveCommandRef = useRef<ReturnType<typeof resolvePendingHomeSaveCommand> | null>(
    null
  );
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
    const next = new URLSearchParams(window.location.search);
    next.delete('edit');
    setSearchParams(next, { replace: true });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const retainedEntry = editEntryFocusRef.current;
        const fallbackEntry = document.querySelector<HTMLElement>('[data-home-edit-trigger]');
        const target = retainedEntry?.isConnected ? retainedEntry : fallbackEntry;
        target?.focus({ preventScroll: true });
      });
    });
  }, [setSearchParams]);
  const homeCore = useHomeCoreReadModel({
    auth,
    availableWidth: homeAvailableWidth,
    permissions,
    hasPermission,
    currentInstant,
    locale: i18n.resolvedLanguage || i18n.language || 'en',
    translate: t,
  });
  const {
    entitledApps,
    homeExperienceQuery,
    homeNativeRuntimeState,
    homeRuntimePartial,
    homeV2Runtime,
    homeOverview,
    homeOverviewQuery,
    launchpadCatalog,
    legacyEnabled,
    notificationAuthorizationFailed,
    notificationSummaryAuthorized,
    notificationSummaryQuery,
    recommendationFeedback,
    timeZone,
    widgetRuntimeDecisions,
    widgetShadowObservation,
    workspaceAppsQuery,
  } = homeCore;
  const widgetKeys = useSystemCodeOptions('PLATFORM.HOME_WIDGET', HOME_WIDGET_KEYS, legacyEnabled);
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
    widgets: defaultHomeWidgets(widgetKeys, 'MEMBER', widgetRuntimeDecisions),
    appLayout: createDefaultLaunchpadLayout(entitledApps, launchpadCatalog.groups),
    presentation: 'balanced',
    resetIntent: false,
  }));
  const draftWidgets = draftHistory.present.widgets;
  const draftAppLayout = draftHistory.present.appLayout;
  const draftPresentation = draftHistory.present.presentation;
  const homeExperience = homeExperienceQuery.data;
  const viewStoreEnabled = Boolean(
    HOME_PERSONALIZATION_V2_ENABLED && homeExperience?.homePreferenceStore === 'VIEWS'
  );
  const modeScopedHomeViewsSupported = hasHomeContractCapability(
    homeExperience,
    HOME_CONTRACT_CAPABILITIES.modeScopedViews
  );
  const fourDeviceLayoutsSupported = hasHomeContractCapability(
    homeExperience,
    HOME_CONTRACT_CAPABILITIES.fourDeviceLayouts
  );
  const homeModeKey = resolveBrokeredHomeExperience(
    homeV2Runtime.activation.kind === 'ACTIVE'
      ? homeV2Runtime.activation.result.snapshot.data.mode
      : null,
    homeExperience?.effectiveExperienceVariant ?? 'CLASSIC',
    viewStoreEnabled
  );
  useEffect(() => reportHomeMode?.(homeModeKey), [homeModeKey, reportHomeMode]);
  const editingHomeViewScope = resolveActiveHomeViewScope(
    { modeKey: homeModeKey, modeScoped: modeScopedHomeViewsSupported },
    editSession
  );
  const liveHomeStudioContractScope = useMemo<HomeStudioContractScope>(
    () => ({
      modeKey: editingHomeViewScope.modeKey,
      modeScopedViews: editingHomeViewScope.modeScoped,
      fourDeviceLayoutsSupported,
    }),
    [editingHomeViewScope.modeKey, editingHomeViewScope.modeScoped, fourDeviceLayoutsSupported]
  );
  const effectiveHomeStudioContractScope = studioContractScope ?? liveHomeStudioContractScope;
  const openHomeStudio = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    studioEntryFocusRef.current =
      (activeElement?.matches('[data-home-edit-trigger]') ? activeElement : null) ??
      document.querySelector<HTMLElement>('[data-home-edit-trigger]') ??
      activeElement;
    studioFocusRestorePendingRef.current = false;
    setStudioContractScope((current) =>
      freezeHomeStudioContractScope(current, liveHomeStudioContractScope)
    );
    setStudioOpen(true);
  }, [liveHomeStudioContractScope]);
  const openStudioFromGallery = useCallback(() => {
    setGalleryOpen(false);
    openHomeStudio();
  }, [openHomeStudio]);
  const closeHomeStudio = useCallback(() => {
    studioFocusRestorePendingRef.current = true;
    setStudioOpen(false);
    setStudioContractScope(null);
  }, []);
  const restoreHomeStudioEntryFocus = useCallback(() => {
    if (!studioFocusRestorePendingRef.current) return;
    const retainedEntry = studioEntryFocusRef.current;
    const fallbackEntry = document.querySelector<HTMLElement>('[data-home-edit-trigger]');
    const target = retainedEntry?.isConnected ? retainedEntry : fallbackEntry;
    target?.focus({ preventScroll: true });
    studioEntryFocusRef.current = null;
    studioFocusRestorePendingRef.current = false;
  }, []);
  const activeHomeViewScope = resolveActiveHomeViewScope(
    { modeKey: homeModeKey, modeScoped: modeScopedHomeViewsSupported },
    editSession,
    studioOpen ? studioContractScope : null
  );
  const homeReadModel = useHomePersonalizationReadModel({
    activeHomeViewScope,
    auth,
    availableWidth: homeAvailableWidth,
    core: homeCore,
    currentInstant,
    editSession,
    editorOpen,
    homeModeKey,
    locale: i18n.resolvedLanguage || i18n.language || 'en',
    modeScopedHomeViewsSupported,
    permissions,
    previewDevice,
    registeredWidgetKeys: widgetKeys,
    viewStoreEnabled,
  });
  const {
    activeDeviceOverlay,
    activeHomeViewQueryKey,
    activeWidgetConfigurations,
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
    sourceHomeView,
    widgetPreferences,
  } = homeReadModel;
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
          widgetKeys,
          activeWidgets,
          entitledApps,
          editorFlowHomeEnabled,
          widgetRuntimeDecisions
        ),
      ]),
    [
      activeAppLayout,
      activeWidgets,
      editorFlowHomeEnabled,
      entitledApps,
      widgetKeys,
      widgetRuntimeDecisions,
    ]
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
  const beginEditing = (studioView?: HomeView) => {
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
    let editingDraft = initialEditingDraft;
    let nextEditSession = currentEditSession;
    if (studioView) {
      if (studioView.modeKey !== effectiveHomeStudioContractScope.modeKey) {
        toast.error(t('page.saveError'));
        return;
      }
      const selectedViewCustomized = resolveHomeViewCustomized(studioView, undefined);
      const selectedWidgets = selectedViewCustomized
        ? reconcileHomeWidgets(
            studioView.layout.widgets,
            widgetKeys,
            audienceProfile,
            widgetRuntimeDecisions
          )
        : defaultHomeWidgets(widgetKeys, audienceProfile, widgetRuntimeDecisions);
      const selectedAppLayout = reconcileLaunchpadLayout(
        canonicalizePersistedLaunchpadLayout(
          studioView.layout.appLayout,
          launchpadCatalog.apps,
          launchpadCatalog.groups
        ),
        entitledApps,
        launchpadCatalog.groups
      );
      editingDraft = {
        appLayout: selectedAppLayout,
        widgets: selectedWidgets,
        presentation: studioView.layout.presentation ?? 'balanced',
        resetIntent: false,
      };
      if (studioView.modeKey === 'FLOW_V1') {
        const migrationEligible = isFlowLegacyGeometryMigrationEligible(
          studioView.schemaVersion,
          studioView.updatedAt
        );
        const sections = normalizeLegacyFlowHomeSections(
          deriveFlowHomeSections(editingDraft.widgets, selectedViewCustomized),
          migrationEligible
        );
        editingDraft = {
          ...editingDraft,
          widgets: applyFlowHomeSections(editingDraft.widgets, sections),
        };
      }
      nextEditSession = createHomeEditSessionFromView(
        studioView,
        effectiveHomeStudioContractScope.modeScopedViews
      );
    }
    replaceDraft(editingDraft);
    setEditBaseDraft(editingDraft);
    setEditSession(nextEditSession);
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
          homeViewQueryKey({
            tenantId: auth.user?.tenantId,
            userId: auth.user?.userId,
            surfaceKey: result.view.surfaceKey,
            modeKey: result.view.modeKey,
            modeScoped: result.modeScopedViews,
          }),
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
        queryClient.invalidateQueries({ queryKey: activeHomeViewQueryKey }),
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
      editSession.experienceVariant,
      editSession.modeScopedViews,
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
    const defaultWidgets = defaultHomeWidgets(widgetKeys, audienceProfile, widgetRuntimeDecisions);
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
  const homeDataRetry = useHomeDataRetry(
    [auth.user?.tenantId, auth.user?.userId],
    legacyEnabled
      ? [
          () => homeOverviewQuery.refetch(),
          ...(notificationSummaryAuthorized ? [() => notificationSummaryQuery.refetch()] : []),
          homeContributionRuntime.retry,
        ]
      : [() => homeV2Runtime.query.refetch()]
  );
  const backgroundUrl = resolveHomeBackgroundUrl(homeExperience);
  const currentDate = formatDate(currentInstant, { dateStyle: 'full' });
  const workspaceUpdatedAt = resolveHomeWorkspaceUpdatedAt(homeOverview);
  const launchApp = createHomeAppLauncher({
    navigate,
    onError: () => toast.error(t('page.appLaunchError')),
    onLaunch: (appId) => appLaunchMutation.mutate(appId),
    v2Active: homeV2Runtime.active,
    workspaceApps: workspaceAppsQuery.data ?? [],
  });
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
    fallbackHeadline: auth.user?.displayName?.split(' ')[0]
      ? t('page.welcomeName', { name: auth.user.displayName.split(' ')[0] })
      : t('page.welcome'),
    fallbackSubheadline: t('page.commandDescription'),
  });
  const homeAssistantAvailable = !editorOpen && isAppResourceEntitled('APP.ASK', permissions);
  const ownerWidgetRegion = <ActiveHomeOwnerWidgetRegion runtime={homeV2Runtime} />;
  return (
    <Box
      ref={homeAvailableWidthRef}
      data-home-assistant-rail={homeAssistantAvailable ? 'header' : 'none'}
      data-home-widget-shadow-status={widgetShadowObservation.status}
      data-home-widget-shadow-mismatch-count={widgetShadowObservation.mismatchCount}
      data-home-widget-shadow-decision-revision={widgetShadowObservation.decisionRevision ?? 'none'}
      {...homeV2RuntimeEvidence(homeV2Runtime)}
      data-home-available-width-class={homeAvailableWidthClass}
      data-home-device-class={deviceClass}
      data-home-mode={editorFlowHomeEnabled ? 'FLOW_V1' : 'CLASSIC'}
      data-home-personal-customization-enabled={personalCustomizationEnabled ? 'true' : 'false'}
      data-home-editor-state={editorOpen ? (editSession ? 'ready' : 'opening') : 'closed'}
      data-home-persisted-source-state={
        persistedSourceLoading ? 'loading' : persistedSourceFailed ? 'failed' : 'ready'
      }
      sx={{
        width: 1,
        maxWidth: '100%',
        minHeight: 0,
        minWidth: 0,
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'clip',
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
          backgroundUrl={homeExperience?.backgroundUrl ? backgroundUrl : undefined}
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
          widgetRuntimeDecisions={widgetRuntimeDecisions}
          overview={homeOverview}
          overviewLoading={homeOverviewQuery.isLoading}
          overviewFetching={homeOverviewQuery.isFetching}
          overviewFailed={homeOverviewHardFailed}
          supplementalPartial={
            homeRuntimePartial || homeOverviewRefreshPartial || homeContributionRuntime.partial
          }
          notificationPartial={launcherSummaryPartial}
          contributionModel={homeContributionRuntime.model}
          contributionLoading={homeContributionRuntime.loading}
          contributionFetching={homeContributionRuntime.fetching}
          contributionPartial={homeContributionRuntime.partial}
          announcementsPolicy={announcementsZone}
          editing={editorActive}
          customizationEnabled={personalCustomizationEnabled}
          customizationBusy={customizationBusy}
          retrying={homeDataRetry.retrying}
          presentation={activePresentation}
          density={activeDeviceOverlay?.density ?? 'comfortable'}
          previewDevice={previewDevice}
          availableWidth={homeAvailableWidth}
          feedbackBusy={legacyEnabled && recommendationFeedback.busy}
          onBrowseAllApps={() => navigate('/apps')}
          onStartEditing={homePageGate.editActionAvailable ? () => beginEditing() : undefined}
          onOpenStudio={homeStudioEnabled && !editorOpen ? openHomeStudio : undefined}
          onAppLayoutChange={setDraftAppLayout}
          onSectionsChange={updateFlowSections}
          onLaunchApp={launchApp}
          onManageApp={(app) => {
            if (app.managementRoute) navigate(app.managementRoute);
          }}
          onRetryOverview={homeDataRetry.retry}
          onRetryContributions={homeDataRetry.retry}
          onRecommendationFeedback={legacyEnabled ? recommendationFeedback.dismiss : undefined}
          futureWidgetStateByKey={wave2Evidence.loadedFlow}
          ownerWidgetRegion={ownerWidgetRegion}
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
          widgetRuntimeDecisions={widgetRuntimeDecisions}
          governedWidgets={governedCanvasWidgets}
          overview={homeOverview}
          overviewLoading={homeOverviewQuery.isLoading}
          overviewFetching={homeOverviewQuery.isFetching}
          overviewFailed={homeOverviewHardFailed}
          nativeRuntimeState={homeNativeRuntimeState}
          editing={editorActive}
          customizationEnabled={personalCustomizationEnabled}
          customizationBusy={customizationBusy}
          personalizationLoading={homePreferenceQuery.isLoading}
          presentation={activePresentation}
          availableWidth={homeAvailableWidth}
          feedbackBusy={legacyEnabled && recommendationFeedback.busy}
          onBrowseAllApps={() => navigate('/apps')}
          onOpenOrganizationUpdates={() => navigate('/communications')}
          onStartEditing={homePageGate.editActionAvailable ? () => beginEditing() : undefined}
          onOpenStudio={homeStudioEnabled && !editorOpen ? openHomeStudio : undefined}
          onAppLayoutChange={setDraftAppLayout}
          onWidgetsChange={setDraftWidgets}
          onLaunchApp={launchApp}
          onManageApp={(app) => {
            if (app.managementRoute) navigate(app.managementRoute);
          }}
          onRetryOverview={() => void homeOverviewQuery.refetch()}
          onRecommendationFeedback={legacyEnabled ? recommendationFeedback.dismiss : undefined}
          organizationResourceState={wave2Evidence.resource}
          disabledAppIds={
            wave2Evidence.resource?.kind === 'forbidden'
              ? ['ref-app-erp', 'ref-app-legacy', 'dwp-admin']
              : undefined
          }
          ownerWidgetRegion={ownerWidgetRegion}
        />
      )}
      <HomeFooter
        updatedAt={workspaceUpdatedAt}
        freshnessInHeader={homePageGate.state.kind === 'ready' && editorFlowHomeEnabled}
      />
      {editorActive && editorFlowHomeEnabled && <HomeEditorSafeArea />}
      <HomeItemGallery
        open={galleryOpen}
        availableApps={entitledApps}
        appLayout={activeAppLayout}
        availableWidgetKeys={widgetKeys}
        widgetPreferences={activeWidgets}
        widgetRuntimeDecisions={widgetRuntimeDecisions}
        catalogEnabled={HOME_WIDGET_LIBRARY_ENABLED}
        flow={editorFlowHomeEnabled}
        busy={customizationBusy}
        onClose={() => setGalleryOpen(false)}
        onAddApp={(app) => setDraftAppLayout((current) => placeLaunchpadApp(current, app))}
        onAddWidget={(widgetKey) =>
          setDraftWidgets((current) =>
            setHomeWidgetVisibility(current, widgetKey, true, widgetRuntimeDecisions)
          )
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
        baseVersion={editSession?.version}
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
      {(homeStudioEnabled || (studioOpen && studioContractScope !== null)) && (
        <Suspense fallback={null}>
          <LazyHomePersonalizationStudio
            open={studioOpen}
            composerEnabled={composerEnabled}
            modeKey={effectiveHomeStudioContractScope.modeKey}
            modeScopedViews={effectiveHomeStudioContractScope.modeScopedViews}
            fourDeviceLayoutsSupported={effectiveHomeStudioContractScope.fourDeviceLayoutsSupported}
            tenantId={auth.user?.tenantId}
            userId={auth.user?.userId}
            seedLayout={effectiveHomeLayout ?? null}
            overview={homeOverview}
            overviewLoading={homeOverviewQuery.isLoading}
            overviewFetching={homeOverviewQuery.isFetching}
            overviewFailed={homeOverviewHardFailed}
            widgetRuntimeDecisions={widgetRuntimeDecisions}
            feedbackBusy={legacyEnabled && recommendationFeedback.busy}
            onRetryOverview={homeDataRetry.retry}
            onRecommendationFeedback={legacyEnabled ? recommendationFeedback.dismiss : undefined}
            onClose={closeHomeStudio}
            onExited={restoreHomeStudioEntryFocus}
            modePreset={
              wave2Evidence.modePreset
                ? {
                    ...wave2Evidence.modePreset,
                    sharedAppOrder: entitledApps.map((app) => ({
                      id: app.id,
                      label: app.name,
                    })),
                  }
                : undefined
            }
            onEditView={(view) => {
              studioFocusRestorePendingRef.current = false;
              beginEditing(view);
            }}
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
