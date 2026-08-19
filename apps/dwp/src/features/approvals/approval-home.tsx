import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock3, FileCheck2, PencilRuler, ShieldAlert, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, PageCanvas, SignalMetric } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  getApprovalHome,
  getHomeSurfacePreference,
  updateHomeSurfacePreference,
  useAuth,
  useToast,
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  dwaionWorkspaceRoute,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkspaceComposerToolbar } from '../../components/workspace-composer/workspace-composer-toolbar';
import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
  visibleWorkspaceRegistry,
} from '../../components/workspace-composer/workspace-composer-model';
import { WorkspaceWidgetCanvas } from '../../components/workspace-composer/workspace-widget-canvas';
import { WorkspaceWidgetGallery } from '../../components/workspace-composer/workspace-widget-gallery';
import { APPROVAL_HOME_WIDGET_REGISTRY } from './approval-home-widget-registry';
import {
  ApprovalLinkRow,
  ApprovalSurface,
  PriorityChip,
  StatusChip,
  approvalTone,
} from './approval-ui';
import { useApprovalExperience } from './use-approval-experience';

import type { ApprovalHomeWidgetKey } from './approval-home-widget-registry';
import type {
  HomePreferenceLayout,
  HomePresentation,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';

function LoadingHome() {
  return (
    <PageCanvas>
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
  const { t } = useTranslation('approvals');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const experience = useApprovalExperience();
  const [editing, setEditing] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [draftPresentation, setDraftPresentation] = useState<HomePresentation>('balanced');
  const [draftWidgets, setDraftWidgets] = useState<
    PersonalHomeWidgetPreference<ApprovalHomeWidgetKey>[]
  >(() => defaultWorkspaceWidgets(APPROVAL_HOME_WIDGET_REGISTRY));
  const registry = useMemo(
    () =>
      visibleWorkspaceRegistry(APPROVAL_HOME_WIDGET_REGISTRY, {
        isManager: false,
        canOperate: experience.canAdmin,
      }),
    [experience.canAdmin]
  );
  const home = useQuery({
    queryKey: ['approvals', 'home', auth.user?.tenantId, auth.user?.userId],
    queryFn: getApprovalHome,
    staleTime: 30_000,
    retry: 1,
  });
  const preference = useQuery({
    queryKey: ['home-preference', 'approval-home', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getHomeSurfacePreference<ApprovalHomeWidgetKey>('approval-home'),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const persistedWidgets = useMemo(
    () => reconcileWorkspaceWidgets(preference.data?.layout.widgets, APPROVAL_HOME_WIDGET_REGISTRY),
    [preference.data?.layout.widgets]
  );
  const persistedPresentation = preference.data?.layout.presentation ?? 'balanced';
  const activeWidgets = editing ? draftWidgets : persistedWidgets;
  const activePresentation = editing ? draftPresentation : persistedPresentation;
  const hiddenWidgetKeys = activeWidgets
    .filter((widget) => !widget.visible && registry.some((item) => item.key === widget.widgetKey))
    .map((widget) => widget.widgetKey);
  const adminLandingPath = experience.canViewOperations
    ? '/approvals/admin/overview'
    : experience.canDesign
      ? '/approvals/admin/workflows'
      : experience.canViewPolicies
        ? '/approvals/admin/policies'
        : '/approvals/admin/signatures';

  useEffect(() => {
    if (editing) return;
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
  }, [editing, persistedPresentation, persistedWidgets]);

  const closeEditor = () => {
    setEditing(false);
    setGalleryOpen(false);
    setBaseVersion(null);
  };
  const mutation = useMutation({
    mutationFn: (layout: HomePreferenceLayout<ApprovalHomeWidgetKey>) =>
      updateHomeSurfacePreference(
        'approval-home',
        layout,
        baseVersion ?? preference.data?.version ?? 0
      ),
    onSuccess: (next) => {
      queryClient.setQueryData(
        ['home-preference', 'approval-home', auth.user?.tenantId, auth.user?.userId],
        next
      );
      closeEditor();
      toast.success(t('home.saved'));
    },
    onError: async (error) => {
      if (error instanceof HttpError && error.status === 409) await preference.refetch();
      closeEditor();
      toast.error(
        t(
          error instanceof HttpError && error.status === 409
            ? 'home.saveConflict'
            : 'home.saveError'
        )
      );
    },
  });

  if (home.isLoading || !home.data) return <LoadingHome />;
  if (home.isError)
    return (
      <PageCanvas>
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

  const data = home.data;
  const renderWidget = (key: ApprovalHomeWidgetKey, _size: HomeWidgetSize) => {
    if (key === 'decision-pulse') {
      return (
        <Paper
          component="section"
          elevation={0}
          sx={{
            minHeight: 214,
            p: { xs: 2.5, md: 3.5 },
            color: 'common.white',
            bgcolor: approvalTone.ink,
            border: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={3}>
            <Box sx={{ maxWidth: 660 }}>
              <Stack direction="row" gap={1} alignItems="center">
                <Chip
                  size="small"
                  icon={<Sparkles size={14} />}
                  label={t('home.pulse.trusted')}
                  sx={{
                    color: '#DCE7FF',
                    borderColor: 'rgba(255,255,255,0.2)',
                    bgcolor: 'rgba(65,105,225,0.2)',
                  }}
                  variant="outlined"
                />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>
                  {formatDate(new Date(data.generatedAt), { timeStyle: 'short' })}
                </Typography>
              </Stack>
              <Typography component="h2" variant="h3" sx={{ mt: 2, maxWidth: 560 }}>
                {t('home.pulse.title', {
                  name: auth.user?.displayName ?? t('home.personFallback'),
                })}
              </Typography>
              <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.72)', maxWidth: 620 }}>
                {t('home.pulse.description', {
                  pending: data.metrics.pending,
                  overdue: data.metrics.overdue,
                })}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ mt: 2.5 }}>
                {experience.canViewTasks && (
                  <ActionButton
                    intent="primary"
                    startIcon={<FileCheck2 size={17} />}
                    onClick={() => navigate('/approvals/inbox')}
                  >
                    {t('actions.reviewInbox')}
                  </ActionButton>
                )}
                {experience.canStartRequests && (
                  <ActionButton
                    intent="quiet"
                    startIcon={<FileInputIcon />}
                    onClick={() => navigate('/approvals/requests/new')}
                    sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.36)' }}
                  >
                    {t('actions.newRequest')}
                  </ActionButton>
                )}
                {experience.canAskExpert && (
                  <ActionButton
                    intent="quiet"
                    startIcon={<Sparkles size={17} />}
                    onClick={() =>
                      navigate(
                        dwaionWorkspaceRoute(undefined, undefined, DWAION_APPROVAL_EXPERT_AGENT_KEY)
                      )
                    }
                    sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.36)' }}
                  >
                    {t('actions.askExpert')}
                  </ActionButton>
                )}
              </Stack>
            </Box>
            <Box
              sx={{
                minWidth: { lg: 460 },
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                border: 1,
                borderColor: 'rgba(255,255,255,0.13)',
              }}
            >
              {[
                [t('metrics.pending'), data.metrics.pending, approvalTone.primary],
                [t('metrics.dueToday'), data.metrics.dueToday, approvalTone.amber],
                [t('metrics.overdue'), data.metrics.overdue, approvalTone.red],
                [
                  t('metrics.sla'),
                  `${formatNumber(data.metrics.slaCompliancePercent)}%`,
                  approvalTone.teal,
                ],
              ].map(([label, value, tone]) => (
                <Box
                  key={String(label)}
                  sx={{
                    minHeight: 86,
                    p: 2,
                    borderRight: 1,
                    borderBottom: 1,
                    borderColor: 'rgba(255,255,255,0.13)',
                    boxShadow: `inset 3px 0 0 ${tone}`,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>
                    {label}
                  </Typography>
                  <Typography component="p" variant="h4" sx={{ mt: 0.5 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Stack>
        </Paper>
      );
    }
    if (key === 'focus-queue')
      return (
        <ApprovalSurface
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
          {data.focusQueue.slice(0, 5).map((task) => (
            <ApprovalLinkRow
              key={task.taskId}
              route="/approvals/inbox"
              title={task.title}
              detail={`${task.stepName} · ${task.requesterName ?? t('home.unknownRequester')}`}
              tone={
                task.riskScore >= 80
                  ? approvalTone.red
                  : task.riskScore >= 60
                    ? approvalTone.amber
                    : approvalTone.primary
              }
              trailing={
                <Stack direction="row" gap={0.75}>
                  <PriorityChip priority={task.priority} />
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    {task.riskScore}
                  </Typography>
                </Stack>
              }
            />
          ))}
        </ApprovalSurface>
      );
    if (key === 'flow') {
      const max = Math.max(1, ...data.flow.map((stage) => stage.count));
      return (
        <ApprovalSurface
          title={t('home.widgets.flow.label')}
          meta={t('home.widgets.flow.description')}
        >
          <Stack gap={1.7} sx={{ p: 2 }}>
            {data.flow.map((stage) => (
              <Box key={stage.stage}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={700}>
                    {t(`status.${stage.stage}`, { defaultValue: stage.stage })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stage.count} · {t('metrics.atRisk', { count: stage.atRisk })}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(stage.count / max) * 100}
                  color={stage.atRisk > 0 ? 'warning' : 'primary'}
                  aria-label={`${t(`status.${stage.stage}`, { defaultValue: stage.stage })} ${stage.count}`}
                  aria-valuetext={`${stage.count}`}
                  sx={{ mt: 0.75, height: 7, borderRadius: 0.5 }}
                />
              </Box>
            ))}
          </Stack>
        </ApprovalSurface>
      );
    }
    if (key === 'my-requests')
      return (
        <ApprovalSurface
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
          {data.recentRequests.slice(0, 4).map((request) => (
            <ApprovalLinkRow
              key={request.requestId}
              route="/approvals/requests/submitted"
              title={request.title}
              detail={
                request.currentStepName
                  ? t('requests.currentStep', {
                      name: request.currentStepName,
                      current: request.currentStepSequence,
                      total: request.totalSteps,
                    })
                  : request.requestNumber
              }
              tone={approvalTone.teal}
              trailing={<StatusChip status={request.status} />}
            />
          ))}
        </ApprovalSurface>
      );
    if (key === 'insights')
      return (
        <ApprovalSurface
          title={t('home.widgets.insights.label')}
          meta={t('home.widgets.insights.description')}
        >
          <Stack gap={1.25} sx={{ p: 2 }}>
            {data.insights.map((insight) => (
              <ButtonBase
                key={insight.key}
                onClick={() => navigate(insight.route)}
                sx={{
                  p: 1.5,
                  display: 'flex',
                  gap: 1.25,
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <ShieldAlert
                  size={19}
                  color={insight.tone === 'critical' ? approvalTone.red : approvalTone.primary}
                />
                <Box>
                  <Typography variant="body2" fontWeight={750}>
                    {t(`insights.${insight.key}.title`, { defaultValue: insight.titleKo })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`insights.${insight.key}.detail`, { defaultValue: insight.detailKo })}
                  </Typography>
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        </ApprovalSurface>
      );
    const pulse = data.adminPulse;
    return (
      <ApprovalSurface
        title={t('home.widgets.admin-health.label')}
        meta={t('home.widgets.admin-health.description')}
        action={
          <ActionButton
            intent="quiet"
            size="small"
            endIcon={<ArrowRight size={15} />}
            onClick={() => navigate(adminLandingPath)}
          >
            {t('actions.openAdmin')}
          </ActionButton>
        }
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
          }}
        >
          {[
            [t('admin.publishedWorkflows'), pulse?.publishedWorkflows ?? 0],
            [t('admin.draftWorkflows'), pulse?.draftWorkflows ?? 0],
            [t('admin.activeRequests'), pulse?.activeRequests ?? 0],
            [t('admin.overdueTasks'), pulse?.overdueTasks ?? 0],
            [t('admin.failedIntegrations'), pulse?.failedIntegrations ?? 0],
          ].map(([label, value], index) => (
            <Box
              key={String(label)}
              sx={{ p: 2, borderRight: index < 4 ? 1 : 0, borderColor: 'divider' }}
            >
              <SignalMetric
                label={String(label)}
                value={String(value)}
                detail={t('home.widgets.admin-health.metricDetail')}
                icon={<ShieldAlert size={17} />}
                tone={Number(value) > 0 && index > 2 ? 'warning' : 'neutral'}
              />
            </Box>
          ))}
        </Box>
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
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('home.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h4">
            {t('home.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.35 }}>
            {t('home.subtitle')}
          </Typography>
        </Box>
        {!editing && (
          <ActionButton
            intent="secondary"
            startIcon={<PencilRuler size={17} />}
            onClick={() => {
              setDraftWidgets(persistedWidgets);
              setDraftPresentation(persistedPresentation);
              setBaseVersion(preference.data?.version ?? 0);
              setEditing(true);
            }}
            disabled={preference.isLoading}
          >
            {t('home.customize')}
          </ActionButton>
        )}
      </Stack>
      {editing && (
        <WorkspaceComposerToolbar
          presentation={draftPresentation}
          busy={mutation.isPending}
          onPresentationChange={setDraftPresentation}
          onAdd={() => setGalleryOpen(true)}
          onReset={() => {
            setDraftWidgets(defaultWorkspaceWidgets(APPROVAL_HOME_WIDGET_REGISTRY));
            setDraftPresentation('balanced');
          }}
          onCancel={closeEditor}
          onDone={() =>
            mutation.mutate({
              appLayout: null,
              presentation: draftPresentation,
              widgets: draftWidgets,
            })
          }
        />
      )}
      <Box
        data-workspace-presentation={activePresentation}
        sx={{
          p: activePresentation === 'expressive' ? { xs: 1, md: 1.5 } : 0,
          bgcolor: activePresentation === 'expressive' ? '#F4F7FB' : 'transparent',
          borderRadius: 1,
          ...(activePresentation === 'focused' && {
            '& [data-workspace-widget]': { filter: 'saturate(0.8)' },
          }),
          ...(activePresentation === 'expressive' && {
            '& [data-workspace-widget] [data-workspace-widget-content] > section': {
              boxShadow: '0 12px 32px rgba(15,23,42,0.09)',
            },
          }),
        }}
      >
        <WorkspaceWidgetCanvas
          registry={registry}
          widgets={activeWidgets}
          editing={editing}
          busy={mutation.isPending}
          presentation={activePresentation}
          getLabel={(key) => t(`home.widgets.${key}.label`)}
          onChange={setDraftWidgets}
          renderWidget={renderWidget}
        />
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
  return <Clock3 size={17} />;
}
