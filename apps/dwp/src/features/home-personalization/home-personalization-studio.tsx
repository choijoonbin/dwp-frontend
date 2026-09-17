import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ContentDialog,
  ErrorState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  activateHomeView,
  applyHomeComposerProposal,
  applyHomeTemplate,
  createHomeCommandKey,
  createHomeComposerProposal,
  createHomeTemplate,
  createHomeView,
  deleteHomeView,
  getHomeDeviceLayouts,
  getHomeTemplates,
  getHomeViewRevisions,
  getHomeViews,
  homeDeviceClassRequestValue,
  isMobileHomeDeviceClass,
  publishHomeTemplate,
  restoreHomeViewRevision,
  revokeHomeTemplate,
  undoHomeComposerProposal,
  updateHomePreference,
  updateHomeDeviceLayout,
  updateHomeView,
  updateHomeWidgetConfiguration,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  HomeAiSection,
  HomeContentSection,
  HomeDeviceSection,
  HomeHistorySection,
  HomeProfilesSection,
  HomeTemplatesSection,
} from './home-studio-sections';
import { HomeAppearanceSection } from './home-appearance-section';
import { HomeModePresetComparison } from './home-mode-preset-comparison';
import { HomeLayoutStudioWorkbench } from '../../components/home-layout-studio-workbench';
import { HOME_V2_QUERY_ROOT } from '../../components/home-v2-query-contract';
import {
  activeHomeView,
  buildWorkstyleChanges,
  createHomeViewKey,
} from './home-personalization-model';
import { homeViewQueryKey, requireHomeViewMode } from '../../components/home-view-query-key';
import { homeStudioNavigation } from './home-studio-navigation';
import { HomeStudioTabs } from './home-studio-tabs';
import {
  createInitialHomeStudioView,
  createLegacyHomeStudioView,
  createNoopHomeComposerProposal,
  homeStudioTemplateQueryKey,
  replaceHomeStudioView,
} from './home-personalization-studio-model';

import type {
  HomeComposerProposal,
  HomeDeviceClass,
  HomePresentation,
  HomePreference,
  HomeTemplate,
  HomeView,
  HomeViewRevision,
  HomeWidgetConfiguration,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';
import type { HomeWorkstyleIntent } from './home-personalization-model';
import { HomeStudioOverviewSection } from './home-studio-overview-section';
import { useHomeViewConflictRecovery } from './use-home-view-conflict-recovery';
import type {
  ActiveHomeStudioSection,
  HomePersonalizationStudioProps,
  HomeStudioWidgetPreference,
} from './home-personalization-studio-contracts';
import { LEGACY_HOME_STUDIO_SECTIONS } from './home-personalization-studio-contracts';

export type {
  ActiveHomeStudioSection,
  HomePersonalizationStudioProps,
} from './home-personalization-studio-contracts';

export function HomePersonalizationStudio({
  open,
  composerEnabled,
  modeKey,
  modeScopedViews,
  preferenceStore = 'LEGACY',
  legacyPreference,
  fourDeviceLayoutsSupported,
  tenantId,
  userId,
  seedLayout,
  overview,
  overviewLoading,
  overviewFetching,
  overviewFailed,
  widgetRuntimeDecisions,
  effectiveWidgetCatalog,
  feedbackBusy,
  onRetryOverview,
  onRecommendationFeedback,
  onClose,
  onExited,
  onEditView,
  onActiveViewChanged,
  modePreset,
  presentation = 'dialog',
  initialSection,
  onSectionChange,
}: HomePersonalizationStudioProps) {
  const { t } = useTranslation('homeStudio');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const legacyStore = preferenceStore === 'LEGACY';
  const modePresetInitialSelectedMode = modePreset?.initialSelectedMode;
  const advancedMode = modeKey !== 'CLASSIC';
  const [section, setSection] = useState<ActiveHomeStudioSection>(
    initialSection ?? (modePreset ? 'mode' : advancedMode ? 'layout' : 'profiles')
  );
  const [appliedMode, setAppliedMode] = useState(modePreset?.currentMode ?? modeKey);
  const [selectedMode, setSelectedMode] = useState(
    modePreset?.initialSelectedMode ?? modePreset?.currentMode ?? modeKey
  );
  const [modeApplying, setModeApplying] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<HomeComposerProposal | null>(null);
  const viewQueryKey = useMemo(
    () =>
      homeViewQueryKey({
        tenantId,
        userId,
        surfaceKey: 'workspace-home',
        modeKey,
        modeScoped: modeScopedViews,
      }),
    [modeKey, modeScopedViews, tenantId, userId]
  );

  const viewsQuery = useQuery({
    queryKey: viewQueryKey,
    queryFn: () => getHomeViews('workspace-home', modeKey, modeScopedViews),
    enabled: open && !legacyStore,
    staleTime: 30_000,
    retry: 1,
  });
  const templatesQuery = useQuery({
    queryKey: homeStudioTemplateQueryKey,
    queryFn: getHomeTemplates,
    enabled: open && !legacyStore,
    staleTime: 60_000,
    retry: 1,
  });
  const legacyView = useMemo(
    () => createLegacyHomeStudioView(legacyStore, legacyPreference, modeKey, t('title')),
    [legacyPreference, legacyStore, modeKey, t]
  );
  const selectedView = useMemo(
    () =>
      legacyView ??
      viewsQuery.data?.find((view) => view.viewId === selectedViewId) ??
      activeHomeView(viewsQuery.data ?? []),
    [legacyView, selectedViewId, viewsQuery.data]
  );
  const initialView = useMemo(
    () =>
      createInitialHomeStudioView(
        legacyStore,
        selectedView,
        seedLayout,
        viewsQuery.isLoading || viewsQuery.isError,
        modeKey,
        t('title')
      ),
    [legacyStore, modeKey, seedLayout, selectedView, t, viewsQuery.isError, viewsQuery.isLoading]
  );
  const editableView = selectedView ?? initialView;
  const deviceLayoutsQuery = useQuery({
    queryKey: ['home-personalization', 'device-layouts', selectedView?.viewId],
    queryFn: () => getHomeDeviceLayouts(selectedView!.viewId),
    enabled: open && !legacyStore && Boolean(selectedView),
    staleTime: 30_000,
    retry: 1,
  });
  const revisionsQuery = useQuery({
    queryKey: ['home-personalization', 'revisions', selectedView?.viewId],
    queryFn: () => getHomeViewRevisions(selectedView!.viewId),
    enabled: open && !legacyStore && Boolean(selectedView),
    staleTime: 15_000,
    retry: 1,
  });
  const conflictRecovery = useHomeViewConflictRecovery({ viewQueryKey, selectedView });

  useEffect(() => {
    if (!open || legacyStore) return;
    if (!selectedViewId || !viewsQuery.data?.some((view) => view.viewId === selectedViewId)) {
      setSelectedViewId(activeHomeView(viewsQuery.data ?? [])?.viewId ?? null);
    }
  }, [legacyStore, open, selectedViewId, viewsQuery.data]);

  useEffect(() => {
    if (!legacyStore) return;
    if (LEGACY_HOME_STUDIO_SECTIONS.includes(section)) return;
    setSection('overview');
    onSectionChange?.('overview');
  }, [legacyStore, onSectionChange, section]);

  useEffect(() => {
    if (!composerEnabled && section === 'ai' && presentation === 'dialog') setSection('profiles');
  }, [composerEnabled, presentation, section]);

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (modePreset?.currentMode) setAppliedMode(modePreset.currentMode);
  }, [modePreset?.currentMode]);
  useEffect(() => {
    if (!open || presentation === 'page' || !modePreset || !modePresetInitialSelectedMode) return;
    setSection('mode');
    setSelectedMode(modePresetInitialSelectedMode);
  }, [modePreset, modePresetInitialSelectedMode, open, presentation]);
  useEffect(() => {
    if (!modePreset && section === 'mode') {
      setSection(advancedMode ? 'layout' : 'profiles');
    }
  }, [advancedMode, modePreset, section]);

  const currentModeView = async (request: Promise<HomeView>) =>
    requireHomeViewMode(await request, modeKey, !modeScopedViews);

  const refreshViewDependencies = async (view: HomeView) => {
    conflictRecovery.clearPendingMutation();
    const resolvedView = requireHomeViewMode(view, modeKey, !modeScopedViews);
    queryClient.setQueryData<HomeView[]>(viewQueryKey, (current) =>
      replaceHomeStudioView(current, resolvedView)
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: viewQueryKey }),
      queryClient.invalidateQueries({
        queryKey: ['home-personalization', 'revisions', resolvedView.viewId],
      }),
      queryClient.invalidateQueries({ queryKey: ['home-preference'] }),
      queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
    ]);
  };

  const refreshLegacyPreference = async (preference: HomePreference<string>) => {
    queryClient.setQueryData(['home-preference', tenantId, userId], preference);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-preference'] }),
      queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
    ]);
  };

  const showMutationError = conflictRecovery.handleMutationError;
  const showNonRecoverableMutationError = () => {
    conflictRecovery.clearPendingMutation();
    toast.error(t('feedback.failed'));
  };
  const latestSelectedView = () =>
    queryClient
      .getQueryData<HomeView[]>(viewQueryKey)
      ?.find((view) => view.viewId === selectedView?.viewId) ?? selectedView;

  const saveEditableLayout = (layout: HomeView['layout'], version?: number) => {
    const view = latestSelectedView();
    if (legacyStore) {
      if (!view) throw new Error('A home preference must be selected.');
      return updateHomePreference(layout, version ?? view.version);
    }
    if (!view) {
      return currentModeView(
        createHomeView(
          {
            viewKey: 'default',
            name: t('title'),
            ...(modeScopedViews ? { modeKey } : {}),
            makeDefault: true,
            layout,
          },
          createHomeCommandKey('create-default-view')
        )
      );
    }
    return currentModeView(
      updateHomeView(
        view.viewId,
        {
          name: view.name,
          layout,
          version: version ?? view.version,
        },
        createHomeCommandKey('update-view-layout')
      )
    );
  };

  const createViewMutation = useMutation({
    mutationFn: (name: string) => {
      const baseLayout = selectedView?.layout ?? seedLayout;
      if (!baseLayout) throw new Error('A source layout is required to create a home view.');
      return currentModeView(
        createHomeView(
          {
            viewKey: createHomeViewKey(
              name,
              (viewsQuery.data ?? []).map((view) => view.viewKey)
            ),
            name,
            ...(modeScopedViews ? { modeKey } : {}),
            makeDefault: (viewsQuery.data?.length ?? 0) === 0,
            layout: baseLayout,
          },
          createHomeCommandKey('create-view')
        )
      );
    },
    onSuccess: async (view) => {
      setSelectedViewId(view.viewId);
      await refreshViewDependencies(view);
      toast.success(t('feedback.created'));
    },
    onError: showNonRecoverableMutationError,
  });
  const activateMutation = useMutation({
    mutationFn: (view: HomeView) =>
      currentModeView(
        activateHomeView(view.viewId, view.version, createHomeCommandKey('activate-view'))
      ),
    onSuccess: async (view) => {
      setSelectedViewId(view.viewId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: viewQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['home-preference'] }),
        queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
      ]);
      onActiveViewChanged?.(view);
      toast.success(t('feedback.activated'));
    },
    onError: showNonRecoverableMutationError,
  });
  const deleteMutation = useMutation({
    mutationFn: (view: HomeView) =>
      deleteHomeView(view.viewId, view.version, createHomeCommandKey('delete-view')),
    onSuccess: async () => {
      setSelectedViewId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: viewQueryKey }),
        queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
      ]);
      toast.success(t('feedback.deleted'));
    },
    onError: showNonRecoverableMutationError,
  });
  const contentMutation = useMutation({
    mutationFn: ({
      widgetKey,
      configuration,
      version,
    }: {
      widgetKey: string;
      configuration: HomeWidgetConfiguration;
      version?: number;
    }) => {
      const view = latestSelectedView();
      if (!view) throw new Error('A home view must be selected.');
      return currentModeView(
        updateHomeWidgetConfiguration(
          view.viewId,
          widgetKey,
          configuration,
          version ?? view.version,
          createHomeCommandKey('configure-widget')
        )
      );
    },
    onSuccess: async (view) => {
      await refreshViewDependencies(view);
      toast.success(t('content.saved'));
    },
    onError: showMutationError,
  });
  const appearanceMutation = useMutation<
    HomeView | HomePreference<string>,
    Error,
    { presentation: HomePresentation; version?: number }
  >({
    mutationFn: ({
      presentation,
      version,
    }: {
      presentation: HomePresentation;
      version?: number;
    }) => {
      const view = latestSelectedView() ?? editableView;
      if (!view) throw new Error('A home preference must be selected.');
      return saveEditableLayout({ ...view.layout, presentation }, version);
    },
    onSuccess: async (result) => {
      if ('viewId' in result) {
        setSelectedViewId(result.viewId);
        await refreshViewDependencies(result);
      } else await refreshLegacyPreference(result);
      toast.success(t('appearance.saved'));
    },
    onError: legacyStore ? showNonRecoverableMutationError : showMutationError,
  });
  const layoutMutation = useMutation<
    HomeView | HomePreference<string>,
    Error,
    { widgets: HomeStudioWidgetPreference[]; version?: number }
  >({
    mutationFn: ({
      widgets,
      version,
    }: {
      widgets: HomeStudioWidgetPreference[];
      version?: number;
    }) => {
      const view = latestSelectedView() ?? editableView;
      if (!view) throw new Error('A home preference must be selected.');
      return saveEditableLayout({ ...view.layout, widgets }, version);
    },
    onSuccess: async (result) => {
      if ('viewId' in result) {
        setSelectedViewId(result.viewId);
        await refreshViewDependencies(result);
      } else await refreshLegacyPreference(result);
      toast.success(t('feedback.saved'));
    },
    onError: legacyStore ? showNonRecoverableMutationError : showMutationError,
  });
  const deviceMutation = useMutation({
    mutationFn: ({
      deviceClass,
      density,
      widgetSizes,
      viewVersion,
      deviceVersion,
    }: {
      deviceClass: HomeDeviceClass;
      density: 'comfortable' | 'compact';
      widgetSizes: Record<string, HomeWidgetSize>;
      viewVersion?: number;
      deviceVersion?: number | null;
    }) => {
      const view = latestSelectedView();
      if (!view) throw new Error('A home view must be selected.');
      const previous = deviceLayoutsQuery.data?.find(
        (layout) => layout.deviceClass === deviceClass
      );
      const semanticOrder = view.layout.widgets
        .filter((widget) => widget.visible && widget.widgetKey !== 'command-rail')
        .map((widget) => widget.widgetKey);
      return updateHomeDeviceLayout(
        view.viewId,
        homeDeviceClassRequestValue(deviceClass, fourDeviceLayoutsSupported),
        {
          density,
          widgetOrder: semanticOrder,
          widgetSizes,
        },
        viewVersion ?? view.version,
        deviceVersion !== undefined ? deviceVersion : (previous?.version ?? null),
        createHomeCommandKey('configure-device')
      );
    },
    onSuccess: async (layout) => {
      conflictRecovery.clearPendingMutation();
      queryClient.setQueryData<HomeView[]>(viewQueryKey, (current) =>
        current?.map((view) =>
          view.viewId === layout.viewId ? { ...view, version: layout.viewVersion } : view
        )
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['home-personalization', 'device-layouts', selectedView?.viewId],
        }),
        queryClient.invalidateQueries({ queryKey: viewQueryKey }),
        queryClient.invalidateQueries({
          queryKey: ['home-personalization', 'revisions', selectedView?.viewId],
        }),
        queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
      ]);
      toast.success(
        t('device.saved', {
          device: isMobileHomeDeviceClass(layout.deviceClass)
            ? t('device.mobile')
            : t('device.desktop'),
        })
      );
    },
    onError: showMutationError,
  });
  const templateApplyMutation = useMutation({
    mutationFn: ({ template, version }: { template: HomeTemplate; version?: number }) => {
      const view = latestSelectedView();
      if (!view) throw new Error('A home view must be selected.');
      return currentModeView(
        applyHomeTemplate(
          template.templateId,
          view.viewId,
          version ?? view.version,
          createHomeCommandKey('apply-template')
        )
      );
    },
    onSuccess: async (view) => {
      await refreshViewDependencies(view);
      toast.success(t('templates.applied'));
    },
    onError: showMutationError,
  });
  const templateDraftMutation = useMutation({
    mutationFn: () => {
      const view = latestSelectedView();
      if (!view) throw new Error('A home view must be selected.');
      return createHomeTemplate(
        {
          templateKey: `personal-${view.viewKey}-${Date.now().toString(36)}`.slice(0, 64),
          name: `${view.name} template`,
          audience: { type: 'ALL', values: [] },
          layout: view.layout,
        },
        createHomeCommandKey('create-template')
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: homeStudioTemplateQueryKey });
      toast.success(t('feedback.created'));
    },
    onError: showNonRecoverableMutationError,
  });
  const templateLifecycleMutation = useMutation({
    mutationFn: ({ template, action }: { template: HomeTemplate; action: 'publish' | 'revoke' }) =>
      action === 'publish'
        ? publishHomeTemplate(
            template.templateId,
            template.version,
            createHomeCommandKey('publish-template')
          )
        : revokeHomeTemplate(
            template.templateId,
            template.version,
            createHomeCommandKey('revoke-template')
          ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: homeStudioTemplateQueryKey });
      toast.success(t('feedback.saved'));
    },
    onError: showNonRecoverableMutationError,
  });
  const restoreMutation = useMutation({
    mutationFn: ({ revision, version }: { revision: HomeViewRevision; version?: number }) => {
      const view = latestSelectedView();
      if (!view) throw new Error('A home view must be selected.');
      return currentModeView(
        restoreHomeViewRevision(
          view.viewId,
          revision.revisionId,
          version ?? view.version,
          createHomeCommandKey('restore-revision')
        )
      );
    },
    onSuccess: async (view) => {
      await refreshViewDependencies(view);
      toast.success(t('history.restored'));
    },
    onError: showMutationError,
  });
  const proposalMutation = useMutation({
    mutationFn: (intent: HomeWorkstyleIntent) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      const changes = buildWorkstyleChanges(selectedView, intent);
      if (changes.length === 0)
        return Promise.resolve(createNoopHomeComposerProposal(selectedView, intent));
      return createHomeComposerProposal(
        {
          viewId: selectedView.viewId,
          baseViewVersion: selectedView.version,
          reasonCodes: [intent],
          changes,
        },
        createHomeCommandKey('composer-proposal')
      );
    },
    onSuccess: setProposal,
    onError: showNonRecoverableMutationError,
  });
  const proposalTransitionMutation = useMutation({
    mutationFn: ({
      proposal: target,
      action,
    }: {
      proposal: HomeComposerProposal;
      action: 'apply' | 'undo';
    }) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      const commandKey = createHomeCommandKey(`composer-${action}`);
      return action === 'apply'
        ? applyHomeComposerProposal(target.proposalId, selectedView.version, commandKey)
        : undoHomeComposerProposal(target.proposalId, selectedView.version, commandKey);
    },
    onSuccess: async (next) => {
      setProposal(next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: viewQueryKey }),
        queryClient.invalidateQueries({
          queryKey: ['home-personalization', 'revisions', selectedView?.viewId],
        }),
        queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
      ]);
      toast.success(next.state === 'UNDONE' ? t('ai.undone') : t('ai.applied'));
    },
    onError: showNonRecoverableMutationError,
  });

  const mutations = [
    createViewMutation,
    activateMutation,
    deleteMutation,
    appearanceMutation,
    layoutMutation,
    contentMutation,
    deviceMutation,
    templateApplyMutation,
    templateDraftMutation,
    templateLifecycleMutation,
    restoreMutation,
    proposalMutation,
    proposalTransitionMutation,
  ];
  const busy = mutations.some((mutation) => mutation.isPending);
  const navItems = homeStudioNavigation({
    presentation,
    modePreset: Boolean(modePreset),
    advancedMode,
    legacyStore,
    composerEnabled,
  });

  const selectSection = (nextSection: ActiveHomeStudioSection) => {
    setSection(nextSection);
    onSectionChange?.(nextSection);
  };

  const handleModeApply = async () => {
    if (!modePreset || selectedMode === appliedMode || modeApplying || modePreset.applying) return;
    setModeApplying(true);
    try {
      await modePreset.onApply?.(selectedMode);
      setAppliedMode(selectedMode);
    } catch {
      toast.error(t('feedback.failed'));
    } finally {
      setModeApplying(false);
    }
  };

  const handleClose = () => {
    if (modePreset) setSelectedMode(appliedMode);
    onClose();
  };

  const studioSurface = (
    <Box
      data-testid={presentation === 'page' ? 'account-home-settings-studio' : undefined}
      data-home-studio-presentation={presentation}
      sx={{
        display: 'grid',
        gridTemplateColumns:
          advancedMode || presentation === 'page'
            ? 'minmax(0, 1fr)'
            : { xs: 'minmax(0, 1fr)', md: '220px minmax(0, 1fr)' },
        gridTemplateRows:
          advancedMode || presentation === 'page' ? 'auto minmax(0, 1fr)' : undefined,
        height:
          presentation === 'page'
            ? section === 'layout'
              ? 'min(860px, calc(100dvh - 220px))'
              : 'auto'
            : fullScreen
              ? 'calc(100dvh - 73px)'
              : advancedMode
                ? 'min(880px, calc(100dvh - 132px))'
                : 'min(720px, calc(100dvh - 150px))',
        minHeight: presentation === 'page' ? { md: section === 'layout' ? 620 : 0 } : { md: 560 },
      }}
    >
      <HomeStudioTabs
        advancedMode={advancedMode}
        fullScreen={fullScreen}
        items={navItems}
        onChange={selectSection}
        presentation={presentation}
        value={section}
      />
      <Box
        role="tabpanel"
        tabIndex={0}
        aria-label={t(`sections.${section}`)}
        data-home-editor-scroll-scope="active-panel"
        data-home-editor-focus-contract="dialog-trap-panel-focus-close-restore"
        sx={{
          overflowY: section === 'layout' ? 'hidden' : 'auto',
          overscrollBehaviorY: 'contain',
          scrollBehavior: 'auto',
          p: section === 'layout' ? 0 : { xs: 2, sm: 3, lg: 4 },
          '&:focus-visible': {
            outline: '3px solid',
            outlineColor: 'primary.main',
            outlineOffset: -3,
          },
          '@media (forced-colors: active)': {
            '&:focus-visible': { outlineColor: 'Highlight' },
          },
        }}
      >
        {section === 'mode' && modePreset ? (
          <Box data-home-studio-mode-surface>
            <HomeModePresetComparison
              currentMode={appliedMode}
              selectedMode={selectedMode}
              allowedModes={modePreset.allowedModes}
              enabledModes={modePreset.enabledModes}
              disabledModeReasons={modePreset.disabledModeReasons}
              defaultMode={modePreset.defaultMode}
              sharedAppOrder={modePreset.sharedAppOrder}
              dirty={selectedMode !== appliedMode}
              disabled={modePreset.disabled}
              applying={modeApplying || modePreset.applying}
              onSelect={setSelectedMode}
              onCancel={() => setSelectedMode(appliedMode)}
              onApply={() => void handleModeApply()}
            />
          </Box>
        ) : (legacyStore ? !legacyPreference : viewsQuery.isLoading) ? (
          <LoadingState label={t('common.loading')} variant="skeleton" size="page" />
        ) : !legacyStore && viewsQuery.isError ? (
          <ErrorState
            title={t('common.unavailable')}
            retryLabel={t('common.retry')}
            retrying={viewsQuery.isFetching}
            onRetry={() => void viewsQuery.refetch()}
            size="page"
          />
        ) : (
          <>
            {section === 'overview' && (
              <HomeStudioOverviewSection
                modeKey={modeKey}
                selectedView={selectedView}
                syncing={viewsQuery.isFetching}
                deviceCount={deviceLayoutsQuery.data?.length ?? 0}
              />
            )}
            {section === 'layout' && (
              <HomeLayoutStudioWorkbench
                view={editableView}
                overview={overview}
                overviewLoading={overviewLoading}
                overviewFetching={overviewFetching}
                overviewFailed={overviewFailed}
                widgetRuntimeDecisions={widgetRuntimeDecisions}
                effectiveWidgetCatalog={effectiveWidgetCatalog}
                busy={busy}
                feedbackBusy={feedbackBusy}
                onRetryOverview={onRetryOverview}
                onRecommendationFeedback={onRecommendationFeedback}
                forceResetToken={conflictRecovery.reloadToken}
                onSave={(widgets, baseVersion) => {
                  if (!legacyStore && selectedView) {
                    conflictRecovery.rememberMutation(
                      ({ viewVersion }) => layoutMutation.mutate({ widgets, version: viewVersion }),
                      widgets.length,
                      baseVersion
                    );
                  }
                  layoutMutation.mutate({ widgets, version: baseVersion });
                }}
                onOpenHistory={() => selectSection('history')}
              />
            )}
            {section === 'profiles' && (
              <HomeProfilesSection
                views={viewsQuery.data ?? []}
                selectedViewId={selectedView?.viewId ?? null}
                busy={busy}
                seedAvailable={Boolean(seedLayout || selectedView)}
                onSelect={(view) => setSelectedViewId(view.viewId)}
                onCreate={(name) => createViewMutation.mutate(name)}
                onActivate={(view) => activateMutation.mutate(view)}
                onDelete={(view) => deleteMutation.mutate(view)}
                onEdit={(view) => {
                  setSelectedViewId(view.viewId);
                  if (presentation === 'page') selectSection('layout');
                  else {
                    onClose();
                    onEditView(view);
                  }
                }}
              />
            )}
            {section === 'appearance' && (
              <HomeAppearanceSection
                view={editableView}
                busy={busy}
                onChange={(nextPresentation) => {
                  if (!legacyStore && selectedView) {
                    conflictRecovery.rememberMutation(({ viewVersion }) =>
                      appearanceMutation.mutate({
                        presentation: nextPresentation,
                        version: viewVersion,
                      })
                    );
                  }
                  appearanceMutation.mutate({ presentation: nextPresentation });
                }}
              />
            )}
            {section === 'content' && (
              <HomeContentSection
                view={selectedView}
                busy={busy}
                onSave={(widgetKey, configuration) => {
                  conflictRecovery.rememberMutation(({ viewVersion }) =>
                    contentMutation.mutate({
                      widgetKey,
                      configuration,
                      version: viewVersion,
                    })
                  );
                  contentMutation.mutate({ widgetKey, configuration });
                }}
              />
            )}
            {section === 'device' &&
              (deviceLayoutsQuery.isError ? (
                <ErrorState
                  title={t('common.unavailable')}
                  retryLabel={t('common.retry')}
                  retrying={deviceLayoutsQuery.isFetching}
                  onRetry={() => void deviceLayoutsQuery.refetch()}
                />
              ) : (
                <HomeDeviceSection
                  view={selectedView}
                  layouts={deviceLayoutsQuery.data ?? []}
                  busy={busy || deviceLayoutsQuery.isLoading}
                  fourDeviceLayoutsSupported={fourDeviceLayoutsSupported}
                  onSave={(deviceClass, density, widgetSizes) => {
                    const previous = deviceLayoutsQuery.data?.find(
                      (layout) => layout.deviceClass === deviceClass
                    );
                    conflictRecovery.rememberMutation(({ viewVersion, deviceVersion }) =>
                      deviceMutation.mutate({
                        deviceClass,
                        density,
                        widgetSizes,
                        viewVersion,
                        deviceVersion:
                          deviceVersion !== undefined ? deviceVersion : (previous?.version ?? null),
                      })
                    );
                    deviceMutation.mutate({ deviceClass, density, widgetSizes });
                  }}
                />
              ))}
            {section === 'templates' &&
              (templatesQuery.isError ? (
                <ErrorState
                  title={t('common.unavailable')}
                  retryLabel={t('common.retry')}
                  retrying={templatesQuery.isFetching}
                  onRetry={() => void templatesQuery.refetch()}
                />
              ) : templatesQuery.isLoading ? (
                <LoadingState label={t('common.loading')} variant="skeleton" />
              ) : (
                <HomeTemplatesSection
                  templates={templatesQuery.data ?? []}
                  view={selectedView}
                  canManage={hasPermission('ADMIN.HOME_TEMPLATE', 'MANAGE')}
                  busy={busy}
                  onApply={(template) => {
                    conflictRecovery.rememberMutation(({ viewVersion }) =>
                      templateApplyMutation.mutate({ template, version: viewVersion })
                    );
                    templateApplyMutation.mutate({ template });
                  }}
                  onDraft={() => templateDraftMutation.mutate()}
                  onPublish={(template) =>
                    templateLifecycleMutation.mutate({ template, action: 'publish' })
                  }
                  onRevoke={(template) =>
                    templateLifecycleMutation.mutate({ template, action: 'revoke' })
                  }
                />
              ))}
            {section === 'history' &&
              (revisionsQuery.isError ? (
                <ErrorState
                  title={t('common.unavailable')}
                  retryLabel={t('common.retry')}
                  retrying={revisionsQuery.isFetching}
                  onRetry={() => void revisionsQuery.refetch()}
                />
              ) : (
                <HomeHistorySection
                  view={selectedView}
                  revisions={revisionsQuery.data ?? []}
                  busy={busy || revisionsQuery.isLoading}
                  onRestore={(revision) => {
                    conflictRecovery.rememberMutation(({ viewVersion }) =>
                      restoreMutation.mutate({ revision, version: viewVersion })
                    );
                    restoreMutation.mutate({ revision });
                  }}
                />
              ))}
            {section === 'ai' && !composerEnabled && (
              <InlineFeedback severity="info">{t('ai.unavailable')}</InlineFeedback>
            )}
            {section === 'ai' && composerEnabled && (
              <HomeAiSection
                view={selectedView}
                proposal={proposal}
                busy={busy}
                onRequest={(intent) => proposalMutation.mutate(intent)}
                onApply={(target) =>
                  proposalTransitionMutation.mutate({ proposal: target, action: 'apply' })
                }
                onUndo={(target) =>
                  proposalTransitionMutation.mutate({ proposal: target, action: 'undo' })
                }
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {presentation === 'dialog' ? (
        <ContentDialog
          open={open}
          title={t('title')}
          description={t('description')}
          closeLabel={t('close')}
          onClose={handleClose}
          busy={busy || modeApplying || Boolean(modePreset?.applying)}
          fullScreen={fullScreen}
          maxWidth={modePreset || advancedMode ? 'xl' : 'lg'}
          contentDividers
          contentSx={{ p: 0, overflow: 'hidden' }}
          slotProps={{ transition: { onExited } }}
        >
          {studioSurface}
        </ContentDialog>
      ) : (
        studioSurface
      )}
      {conflictRecovery.conflictDialog}
    </>
  );
}
