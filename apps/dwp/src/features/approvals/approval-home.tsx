import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  FilePlus2,
  PencilRuler,
  Radar,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { PageCanvas } from '@dwp-frontend/design-system/components/page-canvas/page-canvas';
import { ProgressMeter } from '@dwp-frontend/design-system/components/progress-meter/progress-meter';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  getApprovalHome,
  getApprovalHomePreference,
  updateApprovalHomePreference,
  useAuth,
  useToast,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { WorkspaceComposerToolbar } from '../../components/workspace-composer/workspace-composer-toolbar';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
  visibleWorkspaceRegistry,
} from '../../components/workspace-composer/workspace-composer-model';
import { WorkspaceWidgetCanvas } from '../../components/workspace-composer/workspace-widget-canvas';
import { WorkspaceWidgetGallery } from '../../components/workspace-composer/workspace-widget-gallery';
import {
  ApprovalExecutiveBriefing,
  ApprovalQuickActions,
  ApprovalRecentActivity,
} from './approval-home-executive-widgets';
import { APPROVAL_HOME_WIDGET_REGISTRY } from './approval-home-widget-registry';
import { ApprovalHomeExecutiveCanvas } from './approval-home-executive-canvas';
import {
  approvalHomeRiskColor,
  approvalRequestProgress,
  approvalHomeRowLimit,
} from './approval-home-model';
import { approvalInsightFallback } from './approval-insight-copy';
import { approvalScopeIdentity } from './approval-command-center-model';
import { ApprovalSurface, PriorityChip, StatusChip } from './approval-ui';
import { useApprovalExperience } from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';

import type { ApprovalHomeWidgetKey } from './approval-home-widget-registry';
import type { LucideIcon } from 'lucide-react';
import type {
  HomePreferenceLayout,
  HomePresentation,
  HomeWidgetSize,
  HomeWidgetHeight,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';

function LoadingHome() {
  const { t } = useTranslation('approvals');
  return (
    <PageCanvas>
      <Typography component="h1" variant="h4" sx={{ mb: 2 }}>
        {t('navigation.items.approvals.home.label')}
      </Typography>
      <Skeleton variant="rounded" height={210} />
      <Box
        sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2 }}
      >
        <Skeleton variant="rounded" height={300} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    </PageCanvas>
  );
}

export function ApprovalHome() {
  const { t, i18n } = useTranslation('approvals');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const experience = useApprovalExperience();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const scopeIdentity = approvalScopeIdentity(requestScope.cacheKey);
  const scopeIdentityRef = useRef(scopeIdentity);
  scopeIdentityRef.current = scopeIdentity;
  const [editing, setEditing] = useState(false);
  const [preferenceConflictVersion, setPreferenceConflictVersion] = useState<number | null>(null);
  const customizeButton = useRef<HTMLButtonElement>(null);
  const preferenceRetryButton = useRef<HTMLButtonElement>(null);
  const homeHeading = useRef<HTMLHeadingElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const focusEditorTransition = useRef(false);
  useEffect(() => {
    if (!focusEditorTransition.current) return;
    focusEditorTransition.current = false;
    const target = editing
      ? editor.current?.querySelector('button')
      : customizeButton.current && !customizeButton.current.disabled
        ? customizeButton.current
        : preferenceRetryButton.current && !preferenceRetryButton.current.disabled
          ? preferenceRetryButton.current
          : homeHeading.current;
    target?.focus();
  }, [editing]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [draftPresentation, setDraftPresentation] = useState<HomePresentation>('balanced');
  const [draftWidgets, setDraftWidgets] = useState<
    PersonalHomeWidgetPreference<ApprovalHomeWidgetKey>[]
  >(() => defaultWorkspaceWidgets(APPROVAL_HOME_WIDGET_REGISTRY));
  useEffect(() => {
    focusEditorTransition.current = false;
    setEditing(false);
    setGalleryOpen(false);
    setBaseVersion(null);
    setPreferenceConflictVersion(null);
    setDraftPresentation('balanced');
    setDraftWidgets(defaultWorkspaceWidgets(APPROVAL_HOME_WIDGET_REGISTRY));
  }, [scopeIdentity]);
  const registry = useMemo(
    () =>
      visibleWorkspaceRegistry(APPROVAL_HOME_WIDGET_REGISTRY, {
        isManager: false,
        canOperate: experience.canAdmin,
      }),
    [experience.canAdmin]
  );
  const home = useQuery({
    queryKey: ['approvals', 'home', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      requestScope.contextScopeKey
        ? getApprovalHome(requestScope.contextScopeKey, signal)
        : getApprovalHome(),
    enabled: requestScope.ready,
    staleTime: 30_000,
    retry: 1,
    meta: requestScope.queryMeta,
  });
  const preference = useQuery({
    queryKey: ['home-preference', 'approval-home', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getApprovalHomePreference<ApprovalHomeWidgetKey>(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    staleTime: 5 * 60_000,
    retry: 1,
    meta: requestScope.queryMeta,
  });
  const persistedWidgets = useMemo(
    () =>
      preference.data?.customized === false
        ? defaultWorkspaceWidgets(APPROVAL_HOME_WIDGET_REGISTRY)
        : reconcileWorkspaceWidgets(preference.data?.layout.widgets, APPROVAL_HOME_WIDGET_REGISTRY),
    [preference.data?.customized, preference.data?.layout.widgets]
  );
  const persistedPresentation = preference.data?.layout.presentation ?? 'balanced';
  const activeWidgets = editing ? draftWidgets : persistedWidgets;
  const activePresentation = editing ? draftPresentation : persistedPresentation;
  const hiddenWidgetKeys = activeWidgets
    .filter((widget) => !widget.visible && registry.some((item) => item.key === widget.widgetKey))
    .map((widget) => widget.widgetKey);
  useEffect(() => {
    if (editing) return;
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
  }, [editing, persistedPresentation, persistedWidgets]);

  const closeEditor = () => {
    focusEditorTransition.current = true;
    setEditing(false);
    setGalleryOpen(false);
    setBaseVersion(null);
    setPreferenceConflictVersion(null);
  };
  const runPreferenceUpdate = useApprovalGovernedMutation(
    'route.approvals.work.home-preference-update.action'
  );
  const mutation = useMutation({
    mutationFn: (command: {
      layout: HomePreferenceLayout<ApprovalHomeWidgetKey>;
      expectedVersion: number;
      scopeIdentity: string;
    }) => {
      if (scopeIdentityRef.current !== command.scopeIdentity || !requestScope.ready) {
        throw new Error('Approval home scope changed.');
      }
      return runPreferenceUpdate((execution) =>
        updateApprovalHomePreference(command.layout, command.expectedVersion, execution)
      );
    },
    onSuccess: (next, command) => {
      if (scopeIdentityRef.current !== command.scopeIdentity) return;
      queryClient.setQueryData(
        ['home-preference', 'approval-home', ...requestScope.cacheKey],
        next
      );
      closeEditor();
      toast.success(t('home.saved'));
    },
    onError: async (error, command) => {
      if (scopeIdentityRef.current !== command.scopeIdentity) return;
      if (isProductSurfaceOperationCancelledError(error)) return;
      if (error instanceof HttpError && error.status === 409) {
        const refreshed = await preference.refetch();
        const latestVersion = refreshed.data?.version ?? null;
        setBaseVersion(latestVersion);
        setPreferenceConflictVersion(latestVersion);
      }
      toast.error(
        t(
          error instanceof HttpError && error.status === 409
            ? 'home.saveConflict'
            : 'home.saveError'
        )
      );
    },
  });

  if (home.isError)
    return (
      <PageCanvas>
        <Typography component="h1" variant="h4" sx={{ mb: 2 }}>
          {t('navigation.items.approvals.home.label')}
        </Typography>
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => home.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('home.loadError')}
        </Alert>
      </PageCanvas>
    );
  if (home.isLoading || !home.data) return <LoadingHome />;

  const data = home.data;
  const renderWidget = (
    key: ApprovalHomeWidgetKey,
    _size: HomeWidgetSize,
    height: HomeWidgetHeight
  ) => {
    const rowLimit = approvalHomeRowLimit(height);
    if (key === 'decision-pulse')
      return <ApprovalExecutiveBriefing data={data} access={experience} />;
    if (key === 'focus-queue')
      return (
        <ApprovalSurface
          appearance="executive"
          title={t('home.widgets.focus-queue.label')}
          meta={t('home.widgets.focus-queue.meta', { count: data.focusQueue.length })}
          action={
            experience.canViewTasks ? (
              <ActionButton
                intent="quiet"
                size="small"
                endIcon={<ArrowRight size={15} />}
                onClick={() => navigate('/approvals/inbox')}
              >
                {t('actions.viewAll')}
              </ActionButton>
            ) : undefined
          }
        >
          {data.focusQueue.length === 0 ? (
            <Box role="status" sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('inbox.empty')}
              </Typography>
            </Box>
          ) : (
            data.focusQueue.slice(0, rowLimit).map((task, index) => (
              <ButtonBase
                key={task.taskId}
                aria-label={`${task.title} ${t('actions.openDetails')}`}
                onClick={() => navigate(`/approvals/inbox?task=${encodeURIComponent(task.taskId)}`)}
                sx={(theme) => ({
                  width: 1,
                  minWidth: 0,
                  px: { xs: 1.5, sm: 2 },
                  py: 1.5,
                  display: 'block',
                  textAlign: 'left',
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor:
                    index === 0
                      ? alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === 'dark' ? 0.1 : 0.035
                        )
                      : 'transparent',
                  '&:last-of-type': { borderBottom: 0 },
                  '&:hover': { bgcolor: 'action.hover' },
                })}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                    <PriorityChip priority={task.priority} />
                    <Typography variant="caption" color="text.secondary">
                      {task.requestNumber}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="caption"
                    color={approvalHomeRiskColor(task.riskScore)}
                    fontWeight="fontWeightBold"
                  >
                    {t('home.commandCenter.riskCompact', { score: task.riskScore })}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  fontWeight="fontWeightBold"
                  sx={{ mt: 0.75, overflowWrap: 'anywhere' }}
                >
                  {task.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.35, overflowWrap: 'anywhere' }}
                >
                  {task.requesterName ?? t('home.unknownRequester')} · {task.stepName}
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                  gap={0.5}
                  sx={{ mt: 0.8 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {task.dueAt
                      ? t('home.focusQueue.dueAt', {
                          date: formatDate(task.dueAt, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })
                      : t('home.commandCenter.noDueDate')}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.5} color="primary.main">
                    <Typography variant="caption" fontWeight="fontWeightBold">
                      {t('home.focusQueue.open')}
                    </Typography>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Stack>
                </Stack>
              </ButtonBase>
            ))
          )}
        </ApprovalSurface>
      );
    if (key === 'quick-actions') return <ApprovalQuickActions access={experience} />;
    if (key === 'flow') {
      const max = Math.max(1, ...data.flow.map((stage) => stage.count));
      return (
        <ApprovalSurface
          appearance="executive"
          title={t('home.widgets.flow.label')}
          meta={t('home.widgets.flow.description')}
        >
          {data.flow.length === 0 ? (
            <HomeEmptyState icon={Radar} text={t('home.flow.empty')} />
          ) : (
            <Stack gap={1.75} sx={{ p: 2 }}>
              {data.flow.map((stage) => (
                <ProgressMeter
                  key={stage.stage}
                  label={t(`status.${stage.stage}`, { defaultValue: stage.stage })}
                  value={(stage.count / max) * 100}
                  valueLabel={`${stage.count} · ${t('metrics.atRisk', { count: stage.atRisk })}`}
                  tone={stage.atRisk > 0 ? 'warning' : 'success'}
                />
              ))}
            </Stack>
          )}
        </ApprovalSurface>
      );
    }
    if (key === 'my-requests')
      return (
        <ApprovalSurface
          appearance="executive"
          title={t('home.widgets.my-requests.label')}
          meta={t('home.widgets.my-requests.description')}
          action={
            experience.canViewRequests ? (
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => navigate('/approvals/requests/submitted')}
              >
                {t('actions.viewAll')}
              </ActionButton>
            ) : undefined
          }
        >
          {data.recentRequests.length === 0 ? (
            <HomeEmptyState icon={FileCheck2} text={t('home.myRequests.empty')} />
          ) : (
            data.recentRequests.slice(0, rowLimit).map((request) => {
              const progress = approvalRequestProgress(request);
              return (
                <ButtonBase
                  key={request.requestId}
                  onClick={() =>
                    navigate(
                      `/approvals/requests/submitted?request=${encodeURIComponent(request.requestId)}`
                    )
                  }
                  sx={{
                    width: 1,
                    minWidth: 0,
                    px: { xs: 1.5, sm: 2 },
                    py: 1.5,
                    display: 'block',
                    textAlign: 'left',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={1}
                  >
                    <Box minWidth={0}>
                      <Typography variant="caption" color="text.secondary">
                        {request.requestNumber}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="fontWeightBold"
                        sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
                      >
                        {request.title}
                      </Typography>
                    </Box>
                    <StatusChip status={request.status} />
                  </Stack>
                  {progress == null ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: 'block' }}
                    >
                      {t(`status.${request.status}`)}
                    </Typography>
                  ) : (
                    <ProgressMeter
                      label={
                        request.status === 'APPROVED'
                          ? t('status.APPROVED')
                          : request.currentStepName
                            ? t('requests.currentStep', {
                                name: request.currentStepName,
                                current: request.currentStepSequence,
                                total: request.totalSteps,
                              })
                            : t('home.myRequests.awaitingStart')
                      }
                      value={progress}
                      valueLabel={`${formatNumber(progress)}%`}
                      size="compact"
                      sx={{ mt: 1 }}
                    />
                  )}
                </ButtonBase>
              );
            })
          )}
        </ApprovalSurface>
      );
    if (key === 'recent-activity')
      return (
        <ApprovalRecentActivity
          requests={data.recentRequests}
          rowLimit={rowLimit}
          canViewRequests={experience.canViewRequests}
        />
      );
    return (
      <ApprovalSurface
        appearance="executive"
        title={t('home.widgets.insights.label')}
        meta={t('home.widgets.insights.description')}
        action={
          experience.canAskExpert ? (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<Sparkles size={15} />}
              onClick={() =>
                navigate(
                  dwaionWorkspaceRoute(undefined, undefined, DWAION_APPROVAL_EXPERT_AGENT_KEY)
                )
              }
            >
              {t('home.insights.askExpert')}
            </ActionButton>
          ) : undefined
        }
      >
        {data.insights.length === 0 ? (
          <HomeEmptyState icon={Sparkles} text={t('home.insights.empty')} />
        ) : (
          <Stack gap={1} sx={{ p: 1.5 }}>
            {data.insights.map((insight) => {
              const fallback = approvalInsightFallback(insight, i18n.resolvedLanguage);
              const critical = ['critical', 'risk'].includes(insight.tone.toLowerCase());
              return (
                <ButtonBase
                  key={insight.key}
                  style={{ borderRadius: foundationTokens.radius.surface }}
                  onClick={() => navigate(insight.route)}
                  sx={(theme) => {
                    const tone = critical ? theme.palette.error.main : theme.palette.primary.main;
                    return {
                      color: tone,
                      minWidth: 0,
                      p: 1.5,
                      display: 'flex',
                      gap: 1.15,
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      border: 1,
                      borderLeft: 3,
                      borderColor: alpha(tone, theme.palette.mode === 'dark' ? 0.55 : 0.28),
                      borderLeftColor: tone,
                      bgcolor: alpha(tone, theme.palette.mode === 'dark' ? 0.09 : 0.025),
                      '&:hover': {
                        borderColor: tone,
                        bgcolor: alpha(tone, theme.palette.mode === 'dark' ? 0.14 : 0.06),
                      },
                    };
                  }}
                >
                  <Box sx={{ color: 'inherit', mt: 0.15 }}>
                    <ShieldAlert size={18} aria-hidden="true" />
                  </Box>
                  <Box minWidth={0}>
                    <Typography
                      variant="body2"
                      fontWeight="fontWeightBold"
                      sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}
                    >
                      {t(`insights.${insight.key}.title`, { defaultValue: fallback.title })}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.4, overflowWrap: 'anywhere' }}
                    >
                      {t(`insights.${insight.key}.detail`, { defaultValue: fallback.detail })}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.8 }}>
                      <Typography
                        variant="caption"
                        color="primary.main"
                        fontWeight="fontWeightBold"
                      >
                        {t('home.insights.open')}
                      </Typography>
                      <ArrowRight size={13} aria-hidden="true" />
                    </Stack>
                  </Box>
                </ButtonBase>
              );
            })}
          </Stack>
        )}
      </ApprovalSurface>
    );
  };

  return (
    <PageCanvas>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 2.5 }}
      >
        <Box sx={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'keep-all' }}>
          <Typography variant="overline" color="primary.main">
            {t('home.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h4" ref={homeHeading} tabIndex={-1}>
            {t('home.greeting', {
              name: auth.user?.displayName ?? t('home.personFallback'),
            })}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.35 }}>
            {t('home.subtitle')}
          </Typography>
        </Box>
        {!editing && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            sx={{ width: { xs: 1, md: 'auto' }, flexShrink: 0, flexWrap: 'wrap' }}
          >
            {experience.canAskExpert && (
              <ActionButton
                intent="secondary"
                startIcon={<Sparkles size={17} />}
                onClick={() =>
                  navigate(
                    dwaionWorkspaceRoute(undefined, undefined, DWAION_APPROVAL_EXPERT_AGENT_KEY)
                  )
                }
              >
                {t('actions.askExpert')}
              </ActionButton>
            )}
            {experience.canStartRequests && (
              <ActionButton
                intent="primary"
                startIcon={<FileInputIcon />}
                onClick={() => navigate('/approvals/requests/new')}
              >
                {t('actions.newRequest')}
              </ActionButton>
            )}
            <ActionButton
              ref={customizeButton}
              intent="secondary"
              startIcon={<PencilRuler size={17} />}
              onClick={() => {
                focusEditorTransition.current = true;
                setDraftWidgets(persistedWidgets);
                setDraftPresentation(persistedPresentation);
                setBaseVersion(preference.data?.version ?? 0);
                setPreferenceConflictVersion(null);
                setEditing(true);
              }}
              disabled={preference.isLoading || preference.isError}
            >
              {t('home.customize')}
            </ActionButton>
          </Stack>
        )}
      </Stack>
      {preference.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              ref={preferenceRetryButton}
              disabled={preference.isFetching}
              onClick={() => void preference.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('home.preferenceLoadError')}
        </Alert>
      )}
      {editing && (
        <Box
          ref={editor}
          sx={{
            display: 'contents',
            '& [data-workspace-composer-placement]': {
              bgcolor: 'background.paper',
              color: 'text.primary',
              borderColor: 'divider',
              maxWidth: 1,
              flexWrap: 'wrap',
            },
          }}
        >
          <WorkspaceComposerToolbar
            presentation={draftPresentation}
            busy={mutation.isPending}
            canSave={!preference.isError}
            onPresentationChange={setDraftPresentation}
            onAdd={() => setGalleryOpen(true)}
            onReset={() => {
              setDraftWidgets(defaultWorkspaceWidgets(APPROVAL_HOME_WIDGET_REGISTRY));
              setDraftPresentation('balanced');
            }}
            onCancel={closeEditor}
            onDone={() =>
              mutation.mutate({
                layout: {
                  appLayout: null,
                  presentation: draftPresentation,
                  widgets: draftWidgets,
                },
                expectedVersion: baseVersion ?? preference.data?.version ?? 0,
                scopeIdentity,
              })
            }
          />
        </Box>
      )}
      {editing && preferenceConflictVersion !== null && (
        <Paper
          component="section"
          variant="outlined"
          role="alert"
          sx={{ mb: 2, p: 1.5, borderColor: 'warning.main', bgcolor: 'warning.lighter' }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
            <Stack direction="row" alignItems="flex-start" gap={1}>
              <Box sx={{ color: 'warning.main', mt: 0.15, flex: '0 0 auto' }}>
                <ShieldAlert size={18} aria-hidden="true" />
              </Box>
              <Typography variant="body2">
                {t('home.conflict.description', { version: preferenceConflictVersion })}
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.5}>
              <ActionButton
                intent="quiet"
                size="small"
                disabled={mutation.isPending}
                onClick={closeEditor}
              >
                {t('home.conflict.useServerLayout')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                size="small"
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    layout: {
                      appLayout: null,
                      presentation: draftPresentation,
                      widgets: draftWidgets,
                    },
                    expectedVersion: baseVersion ?? preference.data?.version ?? 0,
                    scopeIdentity,
                  })
                }
              >
                {t('home.conflict.reapplyChanges')}
              </ActionButton>
            </Stack>
          </Stack>
        </Paper>
      )}
      <Box
        data-workspace-presentation={activePresentation}
        style={{ borderRadius: foundationTokens.radius.surface }}
        sx={(theme) => ({
          p: activePresentation === 'expressive' ? { xs: 1, md: 1.5 } : 0,
          bgcolor:
            activePresentation === 'expressive'
              ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.025)
              : 'transparent',
          wordBreak: 'keep-all',
          overflowWrap: 'anywhere',
          '& .MuiButtonBase-root.Mui-focusVisible, & .MuiButtonBase-root:focus-visible': {
            outlineOffset: -3,
          },
        })}
      >
        {!editing && preference.data?.customized !== true ? (
          <ApprovalHomeExecutiveCanvas registry={registry} renderWidget={renderWidget} />
        ) : (
          <WorkspaceWidgetCanvas
            registry={registry}
            widgets={activeWidgets}
            editing={editing}
            busy={mutation.isPending}
            presentation={activePresentation}
            scrollMode="document"
            getLabel={(key) => t(`home.widgets.${key}.label`)}
            onChange={setDraftWidgets}
            renderWidget={renderWidget}
          />
        )}
      </Box>
      <WorkspaceWidgetGallery
        open={galleryOpen}
        registry={registry}
        hiddenWidgetKeys={hiddenWidgetKeys}
        busy={mutation.isPending}
        getLabel={(key) => t(`home.widgets.${key}.label`)}
        getDescription={(key) => t(`home.widgets.${key}.description`)}
        onClose={() => setGalleryOpen(false)}
        onAdd={(key) =>
          setDraftWidgets((current) => setWorkspaceWidgetVisibility(current, registry, key, true))
        }
      />
    </PageCanvas>
  );
}

function FileInputIcon() {
  return <FilePlus2 size={17} />;
}

function HomeEmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <Stack role="status" alignItems="center" gap={1} sx={{ px: 2, py: 5, textAlign: 'center' }}>
      <Box sx={{ color: 'text.secondary' }}>
        <Icon size={25} aria-hidden="true" />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Stack>
  );
}
