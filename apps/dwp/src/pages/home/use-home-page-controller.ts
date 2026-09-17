import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createHomeCommandKey,
  hasHomeContractCapability,
  HOME_CONTRACT_CAPABILITIES,
  HOME_PERSONALIZATION_V2_ENABLED,
  HttpError,
  isAppResourceEntitled,
  launchWorkspaceApp,
  resolveHomeBackgroundUrl,
  updateHomeCurrentMode,
  useAuth,
  usePermissions,
  useToast,
  type HomeView,
  type HomeExperienceVariant,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { createQuestionLaunch } from '@dwp-frontend/shared-utils/api/agent-question-launch-api';
import { createDwaionQuestionLaunchState } from '@dwp-frontend/shared-utils/dwaion-contract';

import { homeViewQueryKey } from '../../components/home-view-query-key';
import {
  canonicalizePersistedLaunchpadLayout,
  createDefaultLaunchpadLayout,
  mergeEntitledLaunchpadProjection,
  reconcileLaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';
import { useSystemCodeOptions } from '../../components/use-system-code-options';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';
import { classicHomeGovernedWidgets } from '../../features/home/classic-home/classic-home-governed-widgets';
import {
  applyFlowHomeSections,
  deriveFlowHomeSections,
  isFlowLegacyGeometryMigrationEligible,
  normalizeLegacyFlowHomeSections,
  type FlowHomeSectionPreference,
} from '../../features/home/flow-home/flow-home-preference';
import {
  commitHomeDraftEdit,
  commitHomeDraftReset,
  homeDraftChangeCount,
  isHomeDraftDirty,
  reapplyHomeDraft,
  type HomeDraft,
} from '../../features/home/home-draft-history';
import {
  homeGalleryRestorableCount,
  resolveHomeAppGalleryItems,
  resolveHomeWidgetGalleryItems,
} from '../../features/home/home-item-gallery-model';
import {
  resolveHomeViewCustomized,
  resolvePendingHomeSaveCommand,
} from '../../features/home-personalization/home-view-bootstrap';
import { createHomeAppLauncher } from '../../features/home/runtime/home-app-launch';
import { useHomeAvailableWidth } from '../../features/home/runtime/home-available-width';
import { useHomeCurrentInstant } from '../../features/home/runtime/use-home-current-instant';
import { useHomeDataRetry } from '../../features/home/runtime/use-home-data-retry';
import { useHomeDraftController } from '../../features/home/runtime/use-home-draft-controller';
import { useHomeEditorEntryFocus } from '../../features/home/runtime/use-home-editor-entry-focus';
import { useHomeEditorSafety } from '../../features/home/runtime/use-home-editor-safety';
import {
  createHomeEditConflictTarget,
  createHomeEditSessionFromView,
  rebaseHomeEditSession,
  saveHomeEditSession,
  type HomeEditConflictTarget,
  type HomeEditSession,
  type HomeSaveMutation,
} from '../../features/home/runtime/home-edit-session';
import { resolveHomeOverviewQueryFailureState } from '../../features/home/runtime/home-overview-query-state';
import {
  resolveHomePageCopy,
  resolveHomeWorkspaceUpdatedAt,
} from '../../features/home/runtime/home-page-runtime-state';
import { resolveBrokeredHomeExperience } from '../../features/home/runtime/home-store-capabilities';
import { reconcileHomeCompositionPolicy } from '../../features/home/home-composition-policy';
import { HOME_V2_QUERY_ROOT } from '../../features/home/runtime/use-home-v2-runtime';
import {
  HOME_WIDGET_KEYS,
  defaultHomeWidgets,
  reconcileHomeWidgets,
} from '../../features/home/home-widget-registry';
import { resolveHomeActiveRuntimeRegions } from './home-active-runtime-regions';
import { useHomeCoreReadModel, useHomePersonalizationReadModel } from './home-page-read-model';
import { resolveWave2Evidence } from './home-wave2-evidence-adapter';
import { useHomeStudioController } from './use-home-studio-controller';

/** Owns Home state, server coordination, and editor lifecycle independently from rendering. */
export function useHomePageController() {
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
  const governMzIntentLaunch = useDwaionGovernedMutation(
    'route.dwaion.work.question-launch-create.action'
  );
  const reportHomeMode = useOutletContext<((mode: HomeExperienceVariant) => void) | null>();
  const [searchParams, setSearchParams] = useSearchParams();
  const wave2Evidence = resolveWave2Evidence(searchParams);
  const queryClient = useQueryClient();
  const mzIntentMutation = useMutation({
    mutationFn: async (intent: string) => {
      const receipt = await governMzIntentLaunch((authority) =>
        createQuestionLaunch(intent, authority)
      );
      const state = createDwaionQuestionLaunchState(receipt.launchId);
      if (!state) throw new Error('Question launch receipt is invalid.');
      return state;
    },
    onSuccess: (state) => navigate('/dwaion/new', { state }),
    onError: () => toast.error(t('mz.stage.handoffError')),
  });
  const [editorOpen, setEditorOpen] = useState(searchParams.get('edit') === 'home');
  const [galleryOpen, setGalleryOpen] = useState(false);
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
    effectiveWidgetCatalog,
    homeExperienceQuery,
    homeNativeRuntimeState,
    homeRuntimePartial,
    homeV2Runtime,
    homeOverview,
    homeOverviewQuery,
    homePreferenceQuery,
    launchpadCatalog,
    legacyEnabled,
    notificationAuthorizationFailed,
    notificationSummaryAuthorized,
    notificationSummaryQuery,
    recommendationAction,
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
  const homeModePolicy = reconcileHomeCompositionPolicy(homeExperience?.compositionPolicy);
  const preferredMode = homePreferenceQuery.data?.currentMode;
  const configuredHomeMode =
    preferredMode && homeModePolicy.allowedModes.includes(preferredMode)
      ? preferredMode
      : homeModePolicy.defaultMode;
  const homeModeKey = resolveBrokeredHomeExperience(
    homeV2Runtime.activation.kind === 'ACTIVE'
      ? homeV2Runtime.activation.result.snapshot.data.mode
      : null,
    configuredHomeMode,
    viewStoreEnabled
  );
  useEffect(() => reportHomeMode?.(homeModeKey), [homeModeKey, reportHomeMode]);
  const {
    activeHomeViewScope,
    closeHomeStudio,
    effectiveHomeStudioContractScope,
    markHomeStudioEditStarted,
    openHomeStudio,
    openStudioFromGallery,
    restoreHomeStudioEntryFocus,
    studioContractScope,
    studioOpen,
  } = useHomeStudioController({
    homeModeKey,
    modeScopedHomeViewsSupported,
    fourDeviceLayoutsSupported,
    editSession,
    homeV2Active: homeV2Runtime.active,
    galleryOpen,
    discardEditorOpen,
    conflictTarget,
    setGalleryOpen,
    setDiscardEditorOpen,
    setConflictTarget,
  });
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
    homePreferenceQuery: personalizationPreferenceQuery,
    homeStudioEnabled,
    homeViewsQuery,
    personalCustomizationEnabled,
    persistedSourceFailed,
    persistedSourceLoading,
    persistedVersion,
    runtimeWidgetPreferences,
    shadowComparison,
    sourceHomeView,
    widgetPreferences,
  } = homeReadModel;
  const homeModeMutation = useMutation({
    mutationFn: async (nextMode: HomeExperienceVariant) => {
      const preference = homePreferenceQuery.data;
      const enabledModes =
        preference?.enabledModes ?? preference?.allowedModes ?? homeModePolicy.allowedModes;
      if (
        !preference ||
        !homeModePolicy.allowedModes.includes(nextMode) ||
        !enabledModes.includes(nextMode)
      ) {
        throw new Error('The requested Home mode is not available for this tenant.');
      }
      return updateHomeCurrentMode(preference, nextMode);
    },
    onSuccess: async (preference) => {
      queryClient.setQueryData(
        ['home-preference', auth.user?.tenantId, auth.user?.userId],
        preference
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home-preference'] }),
        queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
        queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
        queryClient.invalidateQueries({ queryKey: ['home-view'] }),
        queryClient.invalidateQueries({ queryKey: ['home-personalization'] }),
      ]);
    },
  });
  const editorSessionActive = editorOpen && editSession !== null;
  const editorActive = editorSessionActive && !homeV2Runtime.active;
  const activeHomeMode: HomeExperienceVariant =
    editorActive && editSession ? editSession.experienceVariant : homeModeKey;
  const editorFlowHomeEnabled =
    editorActive && editSession ? editSession.experienceVariant !== 'CLASSIC' : flowHomeEnabled;
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
    editorSessionActive && editBaseDraft && isHomeDraftDirty(editBaseDraft, draftHistory.present)
  );
  const rolloutDraftPreserved = homeV2Runtime.active && editSession !== null && draftDirty;
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
    if (
      homeExperienceQuery.isSuccess &&
      !personalCustomizationEnabled &&
      editorOpen &&
      !rolloutDraftPreserved
    ) {
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
    rolloutDraftPreserved,
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
      if (studioView.modeKey !== 'CLASSIC') {
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
  const { flowFutureRuntimeProps, ownerWidgetRegion } = resolveHomeActiveRuntimeRegions(
    homeV2Runtime,
    activeHomeMode,
    activePresentation,
    navigate
  );
  return {
    activeAppLayout,
    activeHomeMode,
    activeDeviceOverlay,
    activePresentation,
    activeWidgetConfigurations,
    activeWidgets,
    announcementsZone,
    audienceProfile,
    auth,
    backgroundUrl,
    beginEditing,
    cancelEditing,
    closeHomeStudio,
    composerEnabled,
    conflictTarget,
    currentDate,
    currentInstant,
    customizationBusy,
    deviceClass,
    discardEditorOpen,
    draftChangeCount,
    draftDirty,
    draftHistory,
    draftPresentation,
    editorActive,
    editorFlowHomeEnabled,
    editorOpen,
    editorResetAvailable,
    editorSourceFailed,
    editSession,
    effectiveHomeLayout,
    effectiveHomeStudioContractScope,
    effectiveWidgetCatalog,
    entitledApps,
    flowFutureRuntimeProps,
    flowSections,
    galleryOpen,
    governedCanvasWidgets,
    homeAssistantAvailable,
    homeContributionRuntime,
    homeDataRetry,
    homeExperience,
    homeHeadline,
    homeNativeRuntimeState,
    homeOverview,
    homeOverviewHardFailed,
    homeOverviewQuery,
    homeOverviewRefreshPartial,
    homePageGate,
    homePreferenceQuery: personalizationPreferenceQuery,
    homeModePreset: homePreference
      ? {
          currentMode: activeHomeMode,
          initialSelectedMode: activeHomeMode,
          allowedModes: homePreference.allowedModes ?? homeModePolicy.allowedModes,
          enabledModes:
            homePreference.enabledModes ??
            homePreference.allowedModes ??
            homeModePolicy.allowedModes,
          disabledModeReasons: homePreference.disabledModeReasons,
          defaultMode: homePreference.defaultMode ?? homeModePolicy.defaultMode,
          disabled: editorOpen || homeModeMutation.isPending,
          applying: homeModeMutation.isPending,
          sharedAppOrder: entitledApps.map((app) => ({ id: app.id, label: app.name })),
          onApply: async (mode: HomeExperienceVariant) => {
            await homeModeMutation.mutateAsync(mode);
          },
        }
      : undefined,
    homeRuntimePartial,
    homeStudioEnabled,
    homeSubheadline,
    homeV2Runtime,
    homeViewsQuery,
    launchApp,
    launcherSummaryPartial,
    launchpadCatalog,
    markHomeStudioEditStarted,
    mzIntentBusy: mzIntentMutation.isPending,
    navigate,
    navigationBlocker,
    openHomeStudio,
    openStudioFromGallery,
    ownerWidgetRegion,
    personalCustomizationEnabled,
    persistedSourceFailed,
    persistedSourceLoading,
    previewDevice,
    recommendationAction,
    reapplyAfterConflict,
    reloadLatestAfterConflict,
    requestCancelEditing,
    resetDraft,
    restorableHomeItemCount,
    restoreHomeStudioEntryFocus,
    rolloutDraftPreserved,
    saveHome,
    startMzIntent: (intent: string) => mzIntentMutation.mutate(intent),
    setConflictTarget,
    setDiscardEditorOpen,
    setDraftAppLayout,
    setDraftPresentation,
    setDraftWidgets,
    setGalleryOpen,
    setPreviewDevice,
    shadowComparison,
    studioContractScope,
    studioOpen,
    t,
    timeZone,
    undoDraft,
    redoDraft,
    updateFlowSections,
    wave2Evidence,
    widgetKeys,
    widgetRuntimeDecisions,
    widgetShadowObservation,
    workspaceUpdatedAt,
    availableWidth: {
      elementRef: homeAvailableWidthRef,
      value: homeAvailableWidth,
      widthClass: homeAvailableWidthClass,
    },
  } as const;
}
