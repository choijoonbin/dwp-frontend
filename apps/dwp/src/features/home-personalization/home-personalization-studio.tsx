import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  History,
  LayoutDashboard,
  MonitorSmartphone,
  Palette,
  PanelsTopLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContentDialog, ErrorState, LoadingState } from '@dwp-frontend/design-system';
import {
  HttpError,
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
  updateHomeDeviceLayout,
  updateHomeView,
  updateHomeWidgetConfiguration,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
import { HomeLayoutStudioWorkbench } from '../../components/home-layout-studio-workbench';
import {
  activeHomeView,
  buildWorkstyleChanges,
  createHomeViewKey,
} from './home-personalization-model';
import { homeViewQueryKey, requireHomeViewMode } from '../../components/home-view-query-key';

import type {
  HomeComposerProposal,
  HomeDeviceClass,
  HomeExperienceVariant,
  HomePresentation,
  HomePreferenceLayout,
  HomeTemplate,
  HomeView,
  HomeViewRevision,
  HomeWidgetConfiguration,
  HomeOverview,
  HomeRecommendation,
  HomeWidgetPreference,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';
import type { HomeStudioSection, HomeWorkstyleIntent } from './home-personalization-model';
import type { HomeWidgetRuntimeDecisions } from '../home/runtime/widget-registry-runtime';

type HomePersonalizationStudioProps = {
  open: boolean;
  composerEnabled: boolean;
  modeKey: HomeExperienceVariant;
  modeScopedViews: boolean;
  fourDeviceLayoutsSupported: boolean;
  tenantId?: number | null;
  userId?: number | null;
  seedLayout: HomePreferenceLayout<string> | null;
  overview?: HomeOverview;
  overviewLoading: boolean;
  overviewFetching: boolean;
  overviewFailed: boolean;
  widgetRuntimeDecisions: HomeWidgetRuntimeDecisions;
  feedbackBusy: boolean;
  onRetryOverview: () => void;
  onRecommendationFeedback: (recommendation: HomeRecommendation) => void;
  onClose: () => void;
  onExited?: () => void;
  onEditView: (view: HomeView) => void;
  onActiveViewChanged?: (view: HomeView) => void;
};

const templateQueryKey = ['home-personalization', 'templates'] as const;

function replaceView(views: readonly HomeView[] | undefined, next: HomeView): HomeView[] {
  if (!views) return [next];
  const exists = views.some((view) => view.viewId === next.viewId);
  return exists
    ? views.map((view) => (view.viewId === next.viewId ? next : view))
    : [...views, next];
}

export function HomePersonalizationStudio({
  open,
  composerEnabled,
  modeKey,
  modeScopedViews,
  fourDeviceLayoutsSupported,
  tenantId,
  userId,
  seedLayout,
  overview,
  overviewLoading,
  overviewFetching,
  overviewFailed,
  widgetRuntimeDecisions,
  feedbackBusy,
  onRetryOverview,
  onRecommendationFeedback,
  onClose,
  onExited,
  onEditView,
  onActiveViewChanged,
}: HomePersonalizationStudioProps) {
  const { t } = useTranslation('homeStudio');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [section, setSection] = useState<HomeStudioSection>(
    modeKey === 'FLOW_V1' ? 'layout' : 'profiles'
  );
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
    enabled: open,
    staleTime: 30_000,
    retry: 1,
  });
  const templatesQuery = useQuery({
    queryKey: templateQueryKey,
    queryFn: getHomeTemplates,
    enabled: open,
    staleTime: 60_000,
    retry: 1,
  });
  const selectedView = useMemo(
    () =>
      viewsQuery.data?.find((view) => view.viewId === selectedViewId) ??
      activeHomeView(viewsQuery.data ?? []),
    [selectedViewId, viewsQuery.data]
  );
  const deviceLayoutsQuery = useQuery({
    queryKey: ['home-personalization', 'device-layouts', selectedView?.viewId],
    queryFn: () => getHomeDeviceLayouts(selectedView!.viewId),
    enabled: open && Boolean(selectedView),
    staleTime: 30_000,
    retry: 1,
  });
  const revisionsQuery = useQuery({
    queryKey: ['home-personalization', 'revisions', selectedView?.viewId],
    queryFn: () => getHomeViewRevisions(selectedView!.viewId),
    enabled: open && Boolean(selectedView),
    staleTime: 15_000,
    retry: 1,
  });

  useEffect(() => {
    if (!open) return;
    if (!selectedViewId || !viewsQuery.data?.some((view) => view.viewId === selectedViewId)) {
      setSelectedViewId(activeHomeView(viewsQuery.data ?? [])?.viewId ?? null);
    }
  }, [open, selectedViewId, viewsQuery.data]);

  useEffect(() => {
    if (!composerEnabled && section === 'ai') setSection('profiles');
  }, [composerEnabled, section]);

  const currentModeView = async (request: Promise<HomeView>) =>
    requireHomeViewMode(await request, modeKey, !modeScopedViews);

  const refreshViewDependencies = async (view: HomeView) => {
    const resolvedView = requireHomeViewMode(view, modeKey, !modeScopedViews);
    queryClient.setQueryData<HomeView[]>(viewQueryKey, (current) =>
      replaceView(current, resolvedView)
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: viewQueryKey }),
      queryClient.invalidateQueries({
        queryKey: ['home-personalization', 'revisions', resolvedView.viewId],
      }),
      queryClient.invalidateQueries({ queryKey: ['home-preference'] }),
    ]);
  };

  const showMutationError = async (error: unknown) => {
    if (error instanceof HttpError && error.status === 409) {
      toast.error(t('feedback.conflict'));
      await queryClient.invalidateQueries({ queryKey: viewQueryKey });
      return;
    }
    toast.error(t('feedback.failed'));
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
    onError: showMutationError,
  });
  const activateMutation = useMutation({
    mutationFn: (view: HomeView) =>
      currentModeView(
        activateHomeView(view.viewId, view.version, createHomeCommandKey('activate-view'))
      ),
    onSuccess: async (view) => {
      setSelectedViewId(view.viewId);
      await queryClient.invalidateQueries({ queryKey: viewQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['home-preference'] });
      onActiveViewChanged?.(view);
      toast.success(t('feedback.activated'));
    },
    onError: showMutationError,
  });
  const deleteMutation = useMutation({
    mutationFn: (view: HomeView) =>
      deleteHomeView(view.viewId, view.version, createHomeCommandKey('delete-view')),
    onSuccess: async () => {
      setSelectedViewId(null);
      await queryClient.invalidateQueries({ queryKey: viewQueryKey });
      toast.success(t('feedback.deleted'));
    },
    onError: showMutationError,
  });
  const contentMutation = useMutation({
    mutationFn: ({
      widgetKey,
      configuration,
    }: {
      widgetKey: string;
      configuration: HomeWidgetConfiguration;
    }) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      return currentModeView(
        updateHomeWidgetConfiguration(
          selectedView.viewId,
          widgetKey,
          configuration,
          selectedView.version,
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
  const appearanceMutation = useMutation({
    mutationFn: (presentation: HomePresentation) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      return currentModeView(
        updateHomeView(
          selectedView.viewId,
          {
            name: selectedView.name,
            layout: { ...selectedView.layout, presentation },
            version: selectedView.version,
          },
          createHomeCommandKey('configure-appearance')
        )
      );
    },
    onSuccess: async (view) => {
      await refreshViewDependencies(view);
      toast.success(t('appearance.saved'));
    },
    onError: showMutationError,
  });
  const layoutMutation = useMutation({
    mutationFn: (widgets: HomeWidgetPreference[]) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      return currentModeView(
        updateHomeView(
          selectedView.viewId,
          {
            name: selectedView.name,
            layout: { ...selectedView.layout, widgets },
            version: selectedView.version,
          },
          createHomeCommandKey('configure-layout')
        )
      );
    },
    onSuccess: async (view) => {
      await refreshViewDependencies(view);
      toast.success(t('feedback.saved'));
    },
    onError: showMutationError,
  });
  const deviceMutation = useMutation({
    mutationFn: ({
      deviceClass,
      density,
      widgetSizes,
    }: {
      deviceClass: HomeDeviceClass;
      density: 'comfortable' | 'compact';
      widgetSizes: Record<string, HomeWidgetSize>;
    }) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      const previous = deviceLayoutsQuery.data?.find(
        (layout) => layout.deviceClass === deviceClass
      );
      const semanticOrder = selectedView.layout.widgets
        .filter((widget) => widget.visible && widget.widgetKey !== 'command-rail')
        .map((widget) => widget.widgetKey);
      return updateHomeDeviceLayout(
        selectedView.viewId,
        homeDeviceClassRequestValue(deviceClass, fourDeviceLayoutsSupported),
        {
          density,
          widgetOrder: semanticOrder,
          widgetSizes,
        },
        selectedView.version,
        previous?.version ?? null,
        createHomeCommandKey('configure-device')
      );
    },
    onSuccess: async (layout) => {
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
    mutationFn: (template: HomeTemplate) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      return currentModeView(
        applyHomeTemplate(
          template.templateId,
          selectedView.viewId,
          selectedView.version,
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
      if (!selectedView) throw new Error('A home view must be selected.');
      return createHomeTemplate(
        {
          templateKey: `personal-${selectedView.viewKey}-${Date.now().toString(36)}`.slice(0, 64),
          name: `${selectedView.name} template`,
          audience: { type: 'ALL', values: [] },
          layout: selectedView.layout,
        },
        createHomeCommandKey('create-template')
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: templateQueryKey });
      toast.success(t('feedback.created'));
    },
    onError: showMutationError,
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
      await queryClient.invalidateQueries({ queryKey: templateQueryKey });
      toast.success(t('feedback.saved'));
    },
    onError: showMutationError,
  });
  const restoreMutation = useMutation({
    mutationFn: (revision: HomeViewRevision) => {
      if (!selectedView) throw new Error('A home view must be selected.');
      return currentModeView(
        restoreHomeViewRevision(
          selectedView.viewId,
          revision.revisionId,
          selectedView.version,
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
      if (changes.length === 0) {
        const now = new Date();
        return Promise.resolve({
          proposalId: `noop-${selectedView.viewId}`,
          viewId: selectedView.viewId,
          state: 'PREVIEWED' as const,
          baseViewVersion: selectedView.version,
          reasonCodes: [intent],
          changes: [],
          warnings: [],
          beforeLayout: selectedView.layout,
          proposedLayout: selectedView.layout,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
        });
      }
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
    onError: showMutationError,
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
      await queryClient.invalidateQueries({ queryKey: viewQueryKey });
      await queryClient.invalidateQueries({
        queryKey: ['home-personalization', 'revisions', selectedView?.viewId],
      });
      toast.success(next.state === 'UNDONE' ? t('ai.undone') : t('ai.applied'));
    },
    onError: showMutationError,
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
  const canManageTemplates = hasPermission('ADMIN.HOME_TEMPLATE', 'MANAGE');
  const loading = viewsQuery.isLoading;
  const failed = viewsQuery.isError;

  const navItems: Array<{ key: HomeStudioSection; icon: typeof LayoutDashboard }> = [
    ...(modeKey === 'FLOW_V1' ? ([{ key: 'layout', icon: PanelsTopLeft }] as const) : []),
    { key: 'profiles', icon: LayoutDashboard },
    { key: 'appearance', icon: Palette },
    { key: 'content', icon: SlidersHorizontal },
    { key: 'device', icon: MonitorSmartphone },
    { key: 'templates', icon: PanelsTopLeft },
    { key: 'history', icon: History },
    ...(composerEnabled ? ([{ key: 'ai', icon: Bot }] as const) : []),
  ];

  return (
    <ContentDialog
      open={open}
      title={t('title')}
      description={t('description')}
      closeLabel={t('close')}
      onClose={onClose}
      busy={busy}
      fullScreen={fullScreen}
      maxWidth={modeKey === 'FLOW_V1' ? 'xl' : 'lg'}
      contentDividers
      contentSx={{ p: 0, overflow: 'hidden' }}
      slotProps={{ transition: { onExited } }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns:
            modeKey === 'FLOW_V1'
              ? 'minmax(0, 1fr)'
              : { xs: 'minmax(0, 1fr)', md: '220px minmax(0, 1fr)' },
          gridTemplateRows: modeKey === 'FLOW_V1' ? 'auto minmax(0, 1fr)' : undefined,
          height: fullScreen
            ? 'calc(100dvh - 73px)'
            : modeKey === 'FLOW_V1'
              ? 'min(880px, calc(100dvh - 132px))'
              : 'min(720px, calc(100dvh - 150px))',
          minHeight: { md: 560 },
        }}
      >
        <Tabs
          orientation={fullScreen || modeKey === 'FLOW_V1' ? 'horizontal' : 'vertical'}
          variant="scrollable"
          allowScrollButtonsMobile
          value={section}
          onChange={(_, value: HomeStudioSection) => setSection(value)}
          aria-label={t('title')}
          sx={{
            borderRight: { md: modeKey === 'FLOW_V1' ? 0 : 1 },
            borderBottom: { xs: 1, md: modeKey === 'FLOW_V1' ? 1 : 0 },
            borderColor: 'divider',
            bgcolor: 'background.default',
            '& .MuiTab-root': {
              minHeight: 48,
              justifyContent: { md: modeKey === 'FLOW_V1' ? 'center' : 'flex-start' },
              alignItems: 'center',
              textTransform: 'none',
              px: 2,
              gap: 1.25,
            },
          }}
        >
          {navItems.map(({ key, icon: Icon }) => (
            <Tab
              key={key}
              value={key}
              icon={<Icon size={17} aria-hidden="true" />}
              iconPosition="start"
              label={t(`sections.${key}`)}
            />
          ))}
        </Tabs>
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
          {loading ? (
            <LoadingState label={t('common.loading')} variant="skeleton" size="page" />
          ) : failed ? (
            <ErrorState
              title={t('common.unavailable')}
              retryLabel={t('common.retry')}
              retrying={viewsQuery.isFetching}
              onRetry={() => void viewsQuery.refetch()}
              size="page"
            />
          ) : (
            <>
              {section === 'layout' && (
                <HomeLayoutStudioWorkbench
                  view={selectedView}
                  overview={overview}
                  overviewLoading={overviewLoading}
                  overviewFetching={overviewFetching}
                  overviewFailed={overviewFailed}
                  widgetRuntimeDecisions={widgetRuntimeDecisions}
                  busy={busy}
                  feedbackBusy={feedbackBusy}
                  onRetryOverview={onRetryOverview}
                  onRecommendationFeedback={onRecommendationFeedback}
                  onSave={(widgets) => layoutMutation.mutate(widgets)}
                  onOpenHistory={() => setSection('history')}
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
                    onClose();
                    onEditView(view);
                  }}
                />
              )}
              {section === 'appearance' && (
                <HomeAppearanceSection
                  view={selectedView}
                  busy={busy}
                  onChange={(presentation) => appearanceMutation.mutate(presentation)}
                />
              )}
              {section === 'content' && (
                <HomeContentSection
                  view={selectedView}
                  busy={busy}
                  onSave={(widgetKey, configuration) =>
                    contentMutation.mutate({ widgetKey, configuration })
                  }
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
                    onSave={(deviceClass, density, widgetSizes) =>
                      deviceMutation.mutate({ deviceClass, density, widgetSizes })
                    }
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
                    canManage={canManageTemplates}
                    busy={busy}
                    onApply={(template) => templateApplyMutation.mutate(template)}
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
                    onRestore={(revision) => restoreMutation.mutate(revision)}
                  />
                ))}
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
    </ContentDialog>
  );
}
