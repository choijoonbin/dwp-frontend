import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, CheckCircle2, LayoutDashboard, RefreshCw, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  PageCanvas,
  useDateTimePolicy,
} from '@dwp-frontend/design-system';
import { resolveZonedClock, resolveZonedDateKey } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  getHomeSurfacePreference,
  updateHcmHomePreference,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { WorkspaceComposerToolbar } from '../../components/workspace-composer/workspace-composer-toolbar';
import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
  visibleWorkspaceRegistry,
} from '../../components/workspace-composer/workspace-composer-model';
import { WorkspaceWidgetCanvas } from '../../components/workspace-composer/workspace-widget-canvas';
import { WorkspaceWidgetGallery } from '../../components/workspace-composer/workspace-widget-gallery';
import { HcmAttentionItem, hcmToneColor } from './hcm-home-visuals';
import { HcmHomeWidgetContent } from './hcm-home-widgets';
import { HCM_HOME_WIDGET_REGISTRY } from './hcm-home-widget-registry';
import {
  canLoadHcmHomeSourceSafely,
  composeHcmHomeProvidersSafely,
  hcmHomeProviderHasDegradation,
  hcmHomeProviderStateSummary,
  loadHcmHomeSourceSafely,
  resolveHcmHomeSourceContributionSafely,
  resolveHcmHomeProviderAudiences,
  type HcmHomeProviderContext,
  type HcmHomeModuleProviderRegistry,
} from './hcm-home-provider-adapter';
import { buildHcmHomeViewModel, greetingKey, type HcmHomeMode } from './hcm-home-view-model';
import { useHcmHomeClock } from './use-hcm-home-clock';
import { useHcmAccess } from './use-hcm-experience';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import {
  PRODUCT_PAGE_SHORTCUT_TARGETS,
  useProductPageShortcutAccess,
} from '../../components/product-page-shortcut-access';

import type {
  HomePresentation,
  HomePreferenceLayout,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { HcmHomeWidgetKey } from './hcm-home-widget-registry';

export function HcmHome({
  moduleProviderRegistry,
}: {
  moduleProviderRegistry: HcmHomeModuleProviderRegistry;
}) {
  const { t } = useTranslation('hcm');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { timeZone } = useDateTimePolicy();
  const providerClockMs = useHcmHomeClock();
  const access = useHcmAccess();
  const homeRequestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.personal',
  });
  const { permissions } = usePermissions();
  const employeeServicesShortcut = useProductPageShortcutAccess(
    PRODUCT_PAGE_SHORTCUT_TARGETS.hcmEmployeeServices
  );
  const [homeMode, setHomeMode] = useState<HcmHomeMode>('personal');
  const [editorOpen, setEditorOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editBaseVersion, setEditBaseVersion] = useState<number | null>(null);
  const [draftPresentation, setDraftPresentation] = useState<HomePresentation>('balanced');
  const [draftWidgets, setDraftWidgets] = useState<
    PersonalHomeWidgetPreference<HcmHomeWidgetKey>[]
  >(() => defaultWorkspaceWidgets(HCM_HOME_WIDGET_REGISTRY));
  const resolvedIsManager = access.isManager;
  const providerClockInstant = new Date(providerClockMs).toISOString();
  const providerAsOf =
    resolveZonedDateKey(providerClockMs, timeZone) ?? providerClockInstant.slice(0, 10);
  const providerAudiences = resolveHcmHomeProviderAudiences({
    roles: auth.user?.roles ?? [],
    canAccessPersonal: access.canAccessPersonal,
    isManager: resolvedIsManager,
    canOperate: access.canOperate || access.canAccessOperationsOverview,
    canManageSettings:
      access.canAccessOrganizationDesign ||
      access.canAccessReferenceData ||
      access.canAccessDataOperations ||
      access.canAccessExports,
  });
  const authorityCacheKey = useMemo(
    () =>
      permissions
        .map(
          (permission) =>
            `${permission.resourceType}:${permission.resourceKey}:${permission.permissionCode}:${permission.effect}`
        )
        .sort()
        .join('|'),
    [permissions]
  );
  const providerContext = useMemo<HcmHomeProviderContext>(
    () => ({
      audiences: providerAudiences,
      scope: {
        kind: homeMode === 'team' ? 'TEAM' : 'SELF',
        key: homeMode === 'team' ? 'current-reporting-line' : 'current-person',
      },
      surfaceEntitled: access.canAccessPersonal && (homeMode === 'personal' || resolvedIsManager),
      entitlements: permissions,
      legacyCompatibilityAuthorities: [],
      dataAuthorities: ['LEGACY_AGGREGATE_COMPATIBILITY', 'MODULE_API'],
      tenantCacheKey:
        auth.user?.tenantId === null || auth.user?.tenantId === undefined
          ? null
          : String(auth.user.tenantId),
      subjectCacheKey:
        auth.user?.userId === null || auth.user?.userId === undefined
          ? null
          : String(auth.user.userId),
      authorityCacheKey,
      contextScopeKey: homeRequestScope.contextScopeKey ?? null,
      decisionRevision: homeRequestScope.queryMeta.decisionRevision,
      accessMode: homeRequestScope.queryMeta.accessMode,
      purpose: 'HRIS_HOME',
      asOf: providerAsOf,
      now: providerClockInstant,
      traceId: null,
    }),
    [
      access.canAccessPersonal,
      authorityCacheKey,
      auth.user?.tenantId,
      auth.user?.userId,
      homeMode,
      homeRequestScope.contextScopeKey,
      homeRequestScope.queryMeta.accessMode,
      homeRequestScope.queryMeta.decisionRevision,
      permissions,
      providerAsOf,
      providerAudiences,
      providerClockInstant,
      resolvedIsManager,
    ]
  );
  const providerSourceQueries = useQueries({
    queries: moduleProviderRegistry.sources.map((source) => {
      const enabled = canLoadHcmHomeSourceSafely(
        moduleProviderRegistry,
        source.sourceId,
        providerContext
      );
      return {
        queryKey: source.queryKey(providerContext),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          loadHcmHomeSourceSafely(moduleProviderRegistry, source, providerContext, signal),
        enabled,
        meta: homeRequestScope.queryMeta,
        staleTime: 30_000,
        retry: 1,
      };
    }),
  });

  useEffect(() => {
    if (homeMode === 'team' && !resolvedIsManager) setHomeMode('personal');
  }, [homeMode, resolvedIsManager]);

  const roleRegistry = useMemo(
    () =>
      visibleWorkspaceRegistry(HCM_HOME_WIDGET_REGISTRY, {
        isManager: resolvedIsManager,
        canOperate: false,
      }),
    [resolvedIsManager]
  );
  const eligibleRegistry = useMemo(
    () =>
      roleRegistry.filter((definition) => {
        if (homeMode === 'personal') return definition.key !== 'team';
        return definition.key !== 'profile';
      }),
    [homeMode, roleRegistry]
  );

  const homePreference = useQuery({
    queryKey: ['home-preference', 'hcm-home', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getHomeSurfacePreference<HcmHomeWidgetKey>('hcm-home'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const persistedWidgets = useMemo(() => {
    const reconciled = reconcileWorkspaceWidgets(
      homePreference.data?.layout.widgets,
      HCM_HOME_WIDGET_REGISTRY
    );
    if (homePreference.data?.customized) return reconciled;
    const defaultOrder = new Map(
      HCM_HOME_WIDGET_REGISTRY.map((definition, index) => [definition.key, index])
    );
    return [...reconciled].sort(
      (left, right) =>
        (defaultOrder.get(left.widgetKey) ?? Number.MAX_SAFE_INTEGER) -
        (defaultOrder.get(right.widgetKey) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [homePreference.data?.customized, homePreference.data?.layout.widgets]);
  const persistedPresentation = homePreference.data?.layout.presentation ?? 'balanced';
  const activeWidgets = editorOpen ? draftWidgets : persistedWidgets;
  const activePresentation = editorOpen ? draftPresentation : persistedPresentation;
  const hiddenWidgetKeys = activeWidgets
    .filter(
      (widget) =>
        !widget.visible &&
        eligibleRegistry.some((definition) => definition.key === widget.widgetKey)
    )
    .map((widget) => widget.widgetKey);

  useEffect(() => {
    if (editorOpen) return;
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
  }, [editorOpen, persistedPresentation, persistedWidgets]);

  const closeEditor = () => {
    setGalleryOpen(false);
    setEditorOpen(false);
    setEditBaseVersion(null);
  };
  const beginEditing = () => {
    if (homePreference.isLoading) return;
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
    setEditBaseVersion(homePreference.data?.version ?? 0);
    setEditorOpen(true);
  };
  const cancelEditing = () => {
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
    closeEditor();
  };
  const updatePreference = useProductActionMutation(
    'route.hcm.personal.home-preference-update.action'
  );
  const preferenceMutation = useMutation({
    mutationFn: (layout: HomePreferenceLayout<HcmHomeWidgetKey>) =>
      updatePreference((authority) =>
        updateHcmHomePreference(
          layout,
          editBaseVersion ?? homePreference.data?.version ?? 0,
          authority
        )
      ),
    onSuccess: async (next) => {
      queryClient.setQueryData(
        ['home-preference', 'hcm-home', auth.user?.tenantId, auth.user?.userId],
        next
      );
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
      closeEditor();
      toast.success(t('home.saved'));
    },
    onError: async (error) => {
      if (error instanceof HttpError && error.status === 409) {
        await homePreference.refetch();
        closeEditor();
        toast.error(t('home.saveConflict'));
        return;
      }
      toast.error(t('home.saveError'));
    },
  });
  const customizationBusy = homePreference.isLoading || preferenceMutation.isPending;
  const providerResolutionNowMs = providerSourceQueries.reduce(
    (latest, query) => Math.max(latest, query.dataUpdatedAt, query.errorUpdatedAt),
    providerClockMs
  );
  const providerResolutionContext: HcmHomeProviderContext = {
    ...providerContext,
    now: new Date(providerResolutionNowMs).toISOString(),
  };
  const providerContributions = moduleProviderRegistry.sources.flatMap((source, index) => {
    const query = providerSourceQueries[index];
    const reasonPrefix = source.sourceId.replace(/[^A-Z0-9]+/giu, '_').toLocaleUpperCase('en-US');
    const reasonCode = query?.isError
      ? `${reasonPrefix}_SOURCE_FAILED`
      : query?.isLoading
        ? `${reasonPrefix}_SOURCE_LOADING`
        : `${reasonPrefix}_SOURCE_UNAVAILABLE`;
    const contribution = resolveHcmHomeSourceContributionSafely(
      moduleProviderRegistry,
      source,
      providerResolutionContext,
      {
        hasData: query?.data !== undefined,
        data: query?.data,
        reasonCode: query?.data !== undefined ? `${reasonPrefix}_PROJECTION_FAILED` : reasonCode,
      }
    );
    return contribution ? [contribution] : [];
  });
  const providerComposition = composeHcmHomeProvidersSafely(
    moduleProviderRegistry,
    providerContributions,
    providerResolutionContext
  );
  const moduleProviderSnapshots = providerComposition.snapshots;
  const providerSourcesLoading = providerSourceQueries.some((query) => query.isLoading);
  const providerSourcesRefreshing = providerSourceQueries.some((query) => query.isFetching);
  const providerSourcesFailed = providerSourceQueries.some((query) => query.isError);
  const refreshProviderSources = () =>
    void Promise.all(
      providerSourceQueries.flatMap((query, index) => {
        const source = moduleProviderRegistry.sources[index];
        return source &&
          canLoadHcmHomeSourceSafely(
            moduleProviderRegistry,
            source.sourceId,
            providerResolutionContext
          )
          ? [query.refetch()]
          : [];
      })
    );
  const providerStateSummary = hcmHomeProviderStateSummary(moduleProviderSnapshots);
  const providerDegraded = hcmHomeProviderHasDegradation(moduleProviderSnapshots);
  const greetingHour =
    resolveZonedClock(providerResolutionNowMs, timeZone)?.hour ??
    new Date(providerResolutionNowMs).getHours();
  const today = providerAsOf;
  const compositionMetadata = providerComposition.metadata;
  const {
    domainAvailable,
    currentTime,
    selfDisplayName,
    firstName,
    organizationName,
    businessTitle,
    managerDisplayName,
    directReportCount,
    primaryLeaveBalance,
    standardDayMinutes,
    availableLeaveDays,
    usedLeaveDays,
    payDaysRemaining,
    hasPayCycle,
    activeGoalCount,
    requiredLearningCount,
    activeJourneyCount,
    activeJourneyProgressPercent,
    journeyTargetDays,
    currentDate,
    freshness,
    teamTimePendingCount,
    teamAbsencePendingCount,
    attentionSignals,
    attentionUnavailable,
    tools,
    timeStages,
    modeSummary,
  } = buildHcmHomeViewModel({
    aggregateMetadata: {
      asOf: compositionMetadata?.asOf ?? today,
      generatedAt: compositionMetadata?.generatedAt ?? null,
    },
    homeMode,
    providerSnapshots: moduleProviderSnapshots,
    identity: {
      displayName: auth.user?.displayName,
      jobTitle: auth.user?.jobTitle,
      tenantName: auth.user?.tenantName,
      tenantCode: auth.user?.tenantCode,
    },
    employeeServicesDisclosed: employeeServicesShortcut.disclosed,
    t,
  });

  const openRhythm = () => {
    const target = document.getElementById('hcm-rhythm');
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    target.focus({ preventScroll: true });
  };
  const attentionUnavailableStatus = (
    <Stack
      direction="row"
      alignItems="center"
      gap={1.1}
      role="status"
      aria-live="polite"
      sx={{ minHeight: 72, px: 1.5, py: 1.2, borderTop: 1, borderColor: 'divider' }}
    >
      <ShieldAlert size={22} color={hcmToneColor.amber} aria-hidden="true" />
      <Box>
        <Typography variant="body2" fontWeight={780}>
          {t('home.needsAttention.unavailableTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(`home.needsAttention.${homeMode}Unavailable`)}
        </Typography>
      </Box>
      {(providerSourcesFailed || providerDegraded) && (
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<RefreshCw size={15} />}
          disabled={providerSourcesRefreshing}
          onClick={refreshProviderSources}
        >
          {t('common.retry')}
        </ActionButton>
      )}
    </Stack>
  );

  const renderWidget = (widgetKey: HcmHomeWidgetKey, size: HomeWidgetSize) => (
    <HcmHomeWidgetContent
      widgetKey={widgetKey}
      size={size}
      homeMode={homeMode}
      providerSnapshots={moduleProviderSnapshots}
      tools={tools}
      currentTime={currentTime}
      timeStages={timeStages}
      domainAvailable={domainAvailable}
      availableLeaveDays={availableLeaveDays}
      usedLeaveDays={usedLeaveDays}
      standardDayMinutes={standardDayMinutes}
      primaryLeaveBalance={primaryLeaveBalance}
      payDaysRemaining={payDaysRemaining}
      hasPayCycle={hasPayCycle}
      activeGoalCount={activeGoalCount}
      requiredLearningCount={requiredLearningCount}
      activeJourneyCount={activeJourneyCount}
      activeJourneyProgressPercent={activeJourneyProgressPercent}
      journeyTargetDays={journeyTargetDays}
      selfDisplayName={selfDisplayName}
      businessTitle={businessTitle}
      organizationName={organizationName}
      managerDisplayName={managerDisplayName}
      teamTimePendingCount={teamTimePendingCount}
      teamAbsencePendingCount={teamAbsencePendingCount}
      directReportCount={directReportCount}
    />
  );

  return (
    <PageCanvas>
      <Box
        component="header"
        data-testid="hcm-home-overview"
        data-hris-home-provider-registry={`v${moduleProviderRegistry.schemaVersion}`}
        data-hris-home-data-authority={[
          ...new Set(moduleProviderSnapshots.map((snapshot) => snapshot.dataAuthority)),
        ].join(' ')}
        data-hris-home-provider-states={providerStateSummary}
        data-hris-home-provider-degraded={providerDegraded ? 'true' : 'false'}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
          alignItems: 'end',
          gap: 2,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {currentDate}
            </Typography>
            <Chip
              size="small"
              label={
                providerSourcesLoading
                  ? t('domains.loading')
                  : providerSourcesFailed
                    ? t('domains.loadError')
                    : compositionMetadata?.generatedAt
                      ? t('home.header.updated', { value: freshness })
                      : t('home.header.generatedUnavailable')
              }
              color={
                compositionMetadata?.generatedAt && !providerSourcesFailed && !providerDegraded
                  ? 'default'
                  : 'warning'
              }
              variant={
                compositionMetadata?.generatedAt && !providerSourcesFailed && !providerDegraded
                  ? 'filled'
                  : 'outlined'
              }
              sx={{
                height: 'auto',
                minHeight: 22,
                fontSize: '0.68rem',
                '& .MuiChip-label': { py: 0.25, whiteSpace: 'normal' },
              }}
            />
            {compositionMetadata?.referenceDataPresent && (
              <Chip
                size="small"
                icon={<ShieldAlert size={13} />}
                label={t('home.header.reference')}
                color="warning"
                variant="outlined"
                sx={{
                  height: 'auto',
                  minHeight: 22,
                  fontSize: '0.68rem',
                  '& .MuiChip-label': { py: 0.25, whiteSpace: 'normal' },
                }}
              />
            )}
            {providerDegraded && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RefreshCw size={14} aria-hidden="true" />}
                disabled={providerSourcesRefreshing}
                onClick={refreshProviderSources}
              >
                {t('common.retry')}
              </ActionButton>
            )}
          </Stack>
          <Typography
            component="h1"
            sx={{
              mt: 0.7,
              fontSize: { xs: '1.45rem', sm: '1.7rem' },
              lineHeight: 1.25,
              fontWeight: 840,
              wordBreak: 'keep-all',
            }}
          >
            {t(`home.greeting.${greetingKey(greetingHour)}`, { name: firstName })}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.45, maxWidth: 760, lineHeight: 1.55, wordBreak: 'keep-all' }}
          >
            {modeSummary}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.65, display: 'block' }}>
            {[businessTitle, organizationName].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.8}>
          {resolvedIsManager && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={homeMode}
              onChange={(_event, next: HcmHomeMode | null) => next && setHomeMode(next)}
              aria-label={t('home.mode.label')}
              sx={{ '& .MuiToggleButton-root': { minHeight: 34, px: 1.25, textTransform: 'none' } }}
            >
              <ToggleButton value="personal">{t('home.mode.personal')}</ToggleButton>
              <ToggleButton value="team">{t('home.mode.team')}</ToggleButton>
            </ToggleButtonGroup>
          )}
          {!editorOpen && (
            <ActionIconButton
              label={t('home.customizeLabel')}
              disabled={homePreference.isLoading}
              onClick={beginEditing}
              sx={{ width: 36, height: 36 }}
            >
              <LayoutDashboard size={17} aria-hidden="true" />
            </ActionIconButton>
          )}
        </Stack>
      </Box>

      <Box component="section" aria-labelledby="hcm-needs-attention-title" sx={{ mt: 2.25 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1.15 }}
        >
          <Box>
            <Typography id="hcm-needs-attention-title" component="h2" variant="h6" fontWeight={820}>
              {t('home.needsAttention.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
              {t(`home.needsAttention.${homeMode}Meta`)}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="caption" color="text.secondary">
              {attentionUnavailable && attentionSignals.length
                ? t('home.needsAttention.countPartial', { count: attentionSignals.length })
                : attentionUnavailable
                  ? t('home.needsAttention.countUnavailable')
                  : t('home.needsAttention.count', { count: attentionSignals.length })}
            </Typography>
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowDown size={14} />}
              onClick={openRhythm}
            >
              {t('home.needsAttention.openRhythm')}
            </ActionButton>
          </Stack>
        </Stack>
        {attentionSignals.length ? (
          <Stack gap={0.8}>
            <Box
              component="ul"
              sx={{
                m: 0,
                p: 0,
                listStyle: 'none',
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 0.8,
              }}
            >
              {attentionSignals.slice(0, 3).map((signal) => (
                <Box component="li" key={signal.id} sx={{ minWidth: 0 }}>
                  <HcmAttentionItem
                    icon={signal.icon}
                    title={signal.title}
                    description={signal.description}
                    value={signal.value}
                    actionLabel={signal.actionLabel}
                    priority={signal.priority}
                    onClick={() => navigate(signal.route)}
                  />
                </Box>
              ))}
            </Box>
            {attentionUnavailable && attentionUnavailableStatus}
          </Stack>
        ) : attentionUnavailable ? (
          attentionUnavailableStatus
        ) : (
          <Stack
            direction="row"
            alignItems="center"
            gap={1.1}
            sx={(theme) => ({
              minHeight: 72,
              px: 1.5,
              py: 1.2,
              border: 1,
              borderColor: alpha(hcmToneColor.teal, 0.2),
              borderRadius: 1,
              bgcolor: alpha(hcmToneColor.teal, theme.palette.mode === 'dark' ? 0.08 : 0.025),
            })}
          >
            <CheckCircle2 size={22} color={hcmToneColor.teal} aria-hidden="true" />
            <Box>
              <Typography variant="body2" fontWeight={780}>
                {t('home.needsAttention.clearTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`home.needsAttention.${homeMode}Clear`)}
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>

      {editorOpen && (
        <Box sx={{ mt: 2 }}>
          <WorkspaceComposerToolbar
            presentation={draftPresentation}
            busy={customizationBusy}
            onPresentationChange={setDraftPresentation}
            onAdd={() => setGalleryOpen(true)}
            onReset={() => {
              setDraftWidgets(defaultWorkspaceWidgets(HCM_HOME_WIDGET_REGISTRY));
              setDraftPresentation('balanced');
            }}
            onCancel={cancelEditing}
            onDone={() =>
              preferenceMutation.mutate({
                appLayout: null,
                presentation: draftPresentation,
                widgets: draftWidgets,
              })
            }
          />
        </Box>
      )}

      <Box
        sx={(theme) => ({
          mt: 2.25,
          transition: theme.transitions.create('filter', { duration: 160 }),
          ...(!editorOpen && {
            '& [data-workspace-widget]': {
              animation: 'hcmWidgetEnter 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            },
            '& [data-workspace-widget]:nth-of-type(2)': { animationDelay: '35ms' },
            '& [data-workspace-widget]:nth-of-type(3)': { animationDelay: '70ms' },
            '@keyframes hcmWidgetEnter': {
              from: { transform: 'translateY(6px)' },
              to: { transform: 'translateY(0)' },
            },
          }),
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '& [data-workspace-widget]': { animation: 'none' },
          },
          ...(activePresentation === 'focused' && {
            '& [data-workspace-widget]': { filter: 'saturate(0.82)' },
          }),
        })}
      >
        <WorkspaceWidgetCanvas
          registry={eligibleRegistry}
          widgets={activeWidgets}
          editing={editorOpen}
          busy={customizationBusy}
          presentation={activePresentation}
          scrollMode="document"
          getLabel={(widgetKey) => t(`home.widgets.${widgetKey}.label`)}
          onChange={setDraftWidgets}
          renderWidget={renderWidget}
        />
      </Box>

      <WorkspaceWidgetGallery
        open={galleryOpen}
        registry={eligibleRegistry}
        hiddenWidgetKeys={hiddenWidgetKeys}
        busy={customizationBusy}
        getLabel={(widgetKey) => t(`home.widgets.${widgetKey}.label`)}
        getDescription={(widgetKey) => t(`home.widgets.${widgetKey}.description`)}
        onClose={() => setGalleryOpen(false)}
        onAdd={(widgetKey) =>
          setDraftWidgets((current) =>
            setWorkspaceWidgetVisibility(current, eligibleRegistry, widgetKey, true)
          )
        }
      />
    </PageCanvas>
  );
}
