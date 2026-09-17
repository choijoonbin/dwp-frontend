import { useWorkplaceMemberScopeRevision } from './workplace-member-scope-revision';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarDays, LockKeyhole, MapPin, ShieldCheck, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Temporal } from 'temporal-polyfill';
import {
  deleteWorkplaceWorkPlan,
  getWorkplaceCollaborationOverview,
  getWorkplaceExplore,
  revokeWorkplaceSharingPreference,
  saveWorkplaceSharingPreference,
  saveWorkplaceWorkPlan,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  DatePickerField,
  EmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  formatDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import { LoadingState } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceHomeQueryRange } from './workplace-home-model';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';
import { WorkplaceHomeSectionHeader } from './workplace-home-section-frame';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  WorkplaceSharedPlanMatrix,
  WorkplaceTeamSourceCard,
  workplacePublicPlansForWeek,
} from './workplace-shared-plan-matrix';
import { workplaceSharedPlanDiscoveryPath } from './workplace-shared-plan-discovery';
import {
  workplacePlanWeek,
  workplaceSharingLevels,
  workplaceSharingOptions,
} from './workplace-team-model';

import type {
  WorkplaceSharingPreference,
  WorkplaceSharingVisibility,
  WorkplaceSharedWorkPlan,
  WorkplaceWorkPlan,
  WorkplaceWorkPlanInput,
  WorkplaceWorkMode,
} from '@dwp-frontend/shared-utils';

type Draft = {
  identityKey: string;
  date: string;
  mode: WorkplaceWorkMode;
  siteId: string;
  floorId: string;
  resourceId: string;
  groupRef: string;
  visibility: WorkplaceSharingVisibility;
};
type TeamAction = { scopeKey: string } & (
  | { kind: 'plan'; input: WorkplaceWorkPlanInput }
  | { kind: 'preference'; input: WorkplaceSharingPreference }
  | { kind: 'remove'; planId: string; version: number }
  | { kind: 'revoke'; version: number }
);

function initialDraft(identityKey: string, date: string): Draft {
  return {
    identityKey,
    date,
    mode: 'OFFICE',
    siteId: '',
    floorId: '',
    resourceId: '',
    groupRef: '',
    visibility: 'PRIVATE',
  };
}

export function WorkplaceTeamContext() {
  const { t, i18n } = useTranslation('rooms');
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const toast = useToast();
  const queryClient = useQueryClient();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const timeZone = useMemo(() => resolveSystemTimeZone('Asia/Seoul'), []);
  const today = Temporal.Instant.from(new Date().toISOString())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
  const [storedDraft, setDraft] = useState(() => initialDraft(identityKey, today));
  const draft =
    storedDraft.identityKey === identityKey ? storedDraft : initialDraft(identityKey, today);
  const week = workplacePlanWeek(draft.date);
  const scopeKey = useWorkplaceMemberScopeRevision(
    `${identityKey}:${week.from}:${week.to}:${capabilities.isLoaded}:${capabilities.canViewWorkplace}:${capabilities.canCreateWorkplaceBooking}:${capabilities.canUpdateWorkplaceBooking}`
  );
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const [consentDraft, setConsentDraft] = useState<{
    identityKey: string;
    optIn: boolean;
    visibility: WorkplaceSharingVisibility;
  } | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);
  const [reconcileScope, setReconcileScope] = useState<string | null>(null);
  const [revokedScope, setRevokedScope] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const overviewQuery = useQuery({
    queryKey: ['workplace', 'collaboration', identityKey, week.from, week.to],
    queryFn: () => getWorkplaceCollaborationOverview(week.from, week.to),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const overviewState = workplaceHomeSourceState({
    data: overviewQuery.data,
    error: overviewQuery.error,
    failureCount: overviewQuery.failureCount,
    failureReason: overviewQuery.failureReason,
    isError: overviewQuery.isError,
    isPending: overviewQuery.isPending,
    required: true,
  });
  const overview = capabilities.canViewWorkplace
    ? workplaceHomeSourceData(overviewState, overviewQuery.data)
    : undefined;
  const range = useMemo(() => workplaceHomeQueryRange(new Date(), timeZone), [timeZone]);
  const catalogQuery = useQuery({
    queryKey: ['workplace', 'team-catalog', identityKey, draft.floorId],
    queryFn: () =>
      getWorkplaceExplore(range.availabilityFrom, range.availabilityTo, draft.floorId || null),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const catalogState = workplaceHomeSourceState({
    data: catalogQuery.data,
    error: catalogQuery.error,
    failureCount: catalogQuery.failureCount,
    failureReason: catalogQuery.failureReason,
    isError: catalogQuery.isError,
    isPending: catalogQuery.isPending,
    required: true,
  });
  const catalog = capabilities.canViewWorkplace
    ? workplaceHomeSourceData(catalogState, catalogQuery.data)
    : undefined;
  const siteId = draft.siteId || catalog?.selectedFloor?.siteId || catalog?.sites[0]?.siteId || '';
  const floors = catalog?.floors.filter((floor) => floor.siteId === siteId) ?? [];
  const floorId = draft.floorId || floors[0]?.floorId || '';
  const resources = catalog?.resources.filter((resource) => resource.floorId === floorId) ?? [];
  const groups = overview?.shareableGroups ?? [];
  const consent =
    consentDraft?.identityKey === identityKey
      ? consentDraft
      : {
          identityKey,
          optIn: overview?.preference.optIn ?? false,
          visibility: overview?.preference.visibility ?? ('PRIVATE' as WorkplaceSharingVisibility),
        };
  const visibilityChoices = workplaceSharingOptions({
    enabled: overview?.policy.sharingEnabled ?? false,
    maximumVisibility: overview?.policy.maximumVisibility ?? 'PRIVATE',
    optIn: overview?.preference.optIn ?? false,
    preferredVisibility: overview?.preference.visibility ?? 'PRIVATE',
    hasGroups: groups.length > 0,
  });
  const visibility = visibilityChoices.includes(draft.visibility) ? draft.visibility : 'PRIVATE';
  const preferenceChoices = workplaceSharingLevels.slice(
    1,
    workplaceSharingLevels.indexOf(overview?.policy.maximumVisibility ?? 'PRIVATE') + 1
  );
  const preferredVisibility = preferenceChoices.includes(consent.visibility)
    ? consent.visibility
    : (preferenceChoices[0] ?? 'PRIVATE');
  const currentPlan = overview?.ownPlans.find((plan) => plan.planDate === draft.date);
  const sharedPlans = workplacePublicPlansForWeek(
    overviewState === 'READY' && overview?.policy.sharingEnabled ? overview.sharedPlans : [],
    week.days
  );
  const hydratedDatesRef = useRef(new Set<string>());
  useEffect(() => {
    const key = `${identityKey}:${draft.date}`;
    if (!overview || hydratedDatesRef.current.has(key)) return;
    hydratedDatesRef.current.add(key);
    const plan = overview.ownPlans.find((candidate) => candidate.planDate === draft.date);
    if (
      plan &&
      !draft.siteId &&
      !draft.floorId &&
      !draft.resourceId &&
      !draft.groupRef &&
      draft.mode === 'OFFICE' &&
      draft.visibility === 'PRIVATE'
    ) {
      setDraft({
        identityKey,
        date: plan.planDate,
        mode: plan.mode,
        siteId: plan.siteId ?? '',
        floorId: plan.floorId ?? '',
        resourceId: plan.resourceId ?? '',
        groupRef: plan.groupRef ?? '',
        visibility: plan.visibility,
      });
    }
  }, [draft, identityKey, overview]);
  const needsReconcile = reconcileScope === scopeKey;
  const ready =
    capabilities.canViewWorkplace &&
    overviewState === 'READY' &&
    !overviewQuery.isFetching &&
    !needsReconcile;
  const stateRef = useRef({
    ready,
    canCreate: capabilities.canCreateWorkplaceBooking,
    canUpdate: capabilities.canUpdateWorkplaceBooking,
  });
  stateRef.current = {
    ready,
    canCreate: capabilities.canCreateWorkplaceBooking,
    canUpdate: capabilities.canUpdateWorkplaceBooking,
  };
  const updateDraft = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  useEffect(() => {
    setDraft((current) =>
      current.identityKey === identityKey ? current : initialDraft(identityKey, today)
    );
    setConsentDraft(null);
    setConfirmingRevoke(null);
    setReconcileScope(null);
    setRevokedScope(null);
  }, [identityKey, today]);
  useEffect(() => {
    if (capabilities.isLoaded && !capabilities.canViewWorkplace) {
      setDraft(initialDraft(identityKey, today));
      setConsentDraft(null);
      setConfirmingRevoke(null);
    }
  }, [capabilities.canViewWorkplace, capabilities.isLoaded, identityKey, today]);
  const mutation = useMutation<unknown, Error, TeamAction>({
    mutationFn: (action: TeamAction) => {
      if (action.scopeKey !== scopeRef.current || !stateRef.current.ready)
        throw new Error('workplace-team-source-unverified');
      const mayCreate = action.kind === 'plan' && action.input.version === null;
      if (!(mayCreate ? stateRef.current.canCreate : stateRef.current.canUpdate))
        throw new Error('workplace-team-action-denied');
      if (action.kind === 'plan') return saveWorkplaceWorkPlan(action.input);
      if (action.kind === 'preference') return saveWorkplaceSharingPreference(action.input);
      if (action.kind === 'remove') return deleteWorkplaceWorkPlan(action.planId, action.version);
      return revokeWorkplaceSharingPreference(action.version);
    },
    onSuccess: async (result, action) => {
      if (action.scopeKey !== scopeRef.current) return;
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'collaboration', identityKey],
      });
      if (action.scopeKey !== scopeRef.current) return;
      setConsentDraft(null);
      setConfirmingRevoke(null);
      if (
        action.kind === 'revoke' &&
        result &&
        typeof result === 'object' &&
        'optIn' in result &&
        result.optIn === false &&
        'visibility' in result &&
        result.visibility === 'PRIVATE'
      ) {
        setRevokedScope(action.scopeKey);
      } else if (action.kind === 'preference') {
        setRevokedScope(null);
      }
      toast.success(
        t(
          action.kind === 'revoke'
            ? 'workplace.member.team.revoked'
            : action.kind === 'preference'
              ? 'workplace.member.team.preferenceSaved'
              : 'workplace.member.team.saved'
        )
      );
    },
    onError: (_, action) => {
      if (action.scopeKey !== scopeRef.current) return;
      setReconcileScope(action.scopeKey);
      setConfirmingRevoke(null);
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });
  const busy = mutation.isPending;
  const submit = (action: TeamAction) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    mutation.mutate(action);
  };
  const recheck = async () => {
    const requestedScope = scopeKey;
    const result = await overviewQuery.refetch();
    if (!result.isError && requestedScope === scopeRef.current) {
      setReconcileScope(null);
      mutation.reset();
    }
  };
  const selectDate = (date: string) => {
    const plan = overview?.ownPlans.find((candidate) => candidate.planDate === date);
    setDraft(
      plan
        ? {
            identityKey,
            date,
            mode: plan.mode,
            siteId: plan.siteId ?? '',
            floorId: plan.floorId ?? '',
            resourceId: plan.resourceId ?? '',
            groupRef: plan.groupRef ?? '',
            visibility: plan.visibility,
          }
        : initialDraft(identityKey, date)
    );
  };
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const dateLabel = (date: string) =>
    formatDate(
      `${date}T00:00:00Z`,
      { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' },
      locale
    );
  const locationLabel = (
    plan: Pick<WorkplaceWorkPlan, 'mode' | 'siteId' | 'floorId' | 'resourceId'>
  ) =>
    [
      catalog?.sites.find((site) => site.siteId === plan.siteId)?.name,
      catalog?.floors.find((floor) => floor.floorId === plan.floorId)?.name,
      catalog?.resources.find((resource) => resource.resourceId === plan.resourceId)?.name,
    ]
      .filter(Boolean)
      .join(' · ') || t(`workplace.member.team.modes.${plan.mode}`);
  const sharedDiscoveryAction = (plan: WorkplaceSharedWorkPlan) => {
    const to = workplaceSharedPlanDiscoveryPath(
      plan,
      catalogState === 'READY' && !catalogQuery.isFetching && !overviewQuery.isFetching
        ? catalog
        : undefined
    );
    return to ? (
      <ActionButton component={Link} to={to} intent="quiet" size="small">
        {t('workplace.member.team.findSameFloor')}
      </ActionButton>
    ) : null;
  };
  const canSavePlan =
    ready &&
    !busy &&
    (currentPlan
      ? capabilities.canUpdateWorkplaceBooking
      : capabilities.canCreateWorkplaceBooking) &&
    (draft.mode !== 'OFFICE' || (catalogState === 'READY' && Boolean(siteId))) &&
    (visibility !== 'FLOOR' || Boolean(floorId)) &&
    (visibility !== 'RESOURCE' ||
      resources.some((resource) => resource.resourceId === draft.resourceId));

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.member.team.eyebrow')}
        title={t('workplace.member.team.title')}
        description={t('workplace.member.team.description')}
      />
      {!capabilities.canViewWorkplace && capabilities.isLoaded ? (
        <RoomsPermissionNotice>{t('workplace.member.team.disabled')}</RoomsPermissionNotice>
      ) : null}
      {overviewQuery.isPending ? (
        <LoadingState
          label={t('workplace.explore.loading')}
          variant="skeleton"
          skeletonRows={1}
          skeletonHeight={220}
          embedded
        />
      ) : null}
      {overviewState !== 'READY' && overviewState !== 'LOADING' ? (
        <InlineFeedback
          severity={overviewState === 'STALE' ? 'warning' : 'error'}
          action={
            <ActionButton intent="quiet" onClick={() => void recheck()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t(overviewState === 'STALE' ? 'workplace.staleWarning' : 'workplace.partialWarning')}
        </InlineFeedback>
      ) : null}
      {needsReconcile ? (
        <InlineFeedback
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <ActionButton intent="secondary" onClick={() => void recheck()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.member.team.saveError')}
        </InlineFeedback>
      ) : null}
      {overview ? (
        <>
          <InlineFeedback severity="info" icon={<ShieldCheck size={18} />} sx={{ mb: 2 }}>
            {t('workplace.member.team.presenceNotice')}
          </InlineFeedback>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1.25fr)' },
              gridTemplateAreas: {
                xs: '"sharing" "week" "plan" "shared"',
                lg: '"sharing matrix" "plan ownWeek"',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box
              component="section"
              data-testid="workplace-team-sharing-form"
              sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2.5, gridArea: 'sharing' })}
            >
              <Stack spacing={2}>
                {revokedScope === scopeKey &&
                overviewState === 'READY' &&
                !overview.preference.optIn ? (
                  <Box
                    data-testid="workplace-team-revoke-complete"
                    sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}
                  >
                    <Stack gap={1}>
                      <LockKeyhole size={24} aria-hidden="true" />
                      <Typography component="h2" variant="h6">
                        {t('workplace.member.team.revokeCompleteTitle')}
                      </Typography>
                      <Typography variant="body2">
                        {t('workplace.member.team.revokeCompleteDescription')}
                      </Typography>
                      <Stack direction="row" gap={1} flexWrap="wrap">
                        <ActionButton intent="secondary" onClick={() => setRevokedScope(null)}>
                          {t('workplace.member.team.configureSharing')}
                        </ActionButton>
                        <ActionButton component={Link} to="/workplace/home" intent="quiet">
                          {t('workplace.home.title')}
                        </ActionButton>
                      </Stack>
                    </Stack>
                  </Box>
                ) : null}
                <Typography component="h2" variant="h6">
                  {t('workplace.member.team.sharing')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('workplace.member.team.sharingDescription')}
                </Typography>
                {!overview.policy.sharingEnabled ? (
                  <InlineFeedback severity="info">
                    {t('workplace.member.team.disabled')}
                  </InlineFeedback>
                ) : null}
                {!groups.length ? (
                  <InlineFeedback severity="info">
                    {t('workplace.member.team.noGroups')}
                  </InlineFeedback>
                ) : null}
                <FormControlLabel
                  control={
                    <Switch
                      checked={consent.optIn}
                      disabled={
                        !ready ||
                        busy ||
                        !overview.policy.sharingEnabled ||
                        !capabilities.canUpdateWorkplaceBooking
                      }
                      onChange={(_, optIn) => setConsentDraft({ ...consent, optIn })}
                    />
                  }
                  label={t('workplace.member.team.optIn')}
                />
                <Box>
                  <Typography
                    component="h3"
                    variant="caption"
                    color="text.secondary"
                    fontWeight="fontWeightBold"
                    sx={{ display: 'block', mb: 0.75 }}
                  >
                    {t('workplace.member.team.visibility')}
                  </Typography>
                  <Box
                    role="radiogroup"
                    aria-label={t('workplace.member.team.visibility')}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
                      gap: 0.75,
                    }}
                  >
                    {workplaceSharingLevels.map((level, index) => {
                      const selected = consent.optIn
                        ? preferredVisibility === level
                        : level === 'PRIVATE';
                      const allowed =
                        level === 'PRIVATE' ||
                        (overview.policy.sharingEnabled && preferenceChoices.includes(level));
                      return (
                        <ButtonBase
                          key={level}
                          role="radio"
                          aria-checked={selected}
                          disabled={!ready || busy || !allowed}
                          onClick={() =>
                            setConsentDraft({
                              ...consent,
                              optIn: level !== 'PRIVATE',
                              visibility: level,
                            })
                          }
                          sx={{
                            minHeight: 72,
                            p: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            border: 1,
                            borderColor: selected ? 'primary.main' : 'divider',
                            bgcolor: selected ? 'action.selected' : 'background.paper',
                            opacity: allowed ? 1 : 0.48,
                            '&:focus-visible': {
                              outline: '3px solid',
                              outlineColor: 'primary.light',
                            },
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {String(index + 1).padStart(2, '0')}
                          </Typography>
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {t(`workplace.member.team.visibilities.${level}`)}
                          </Typography>
                        </ButtonBase>
                      );
                    })}
                  </Box>
                </Box>
                <ActionButton
                  intent="primary"
                  data-testid="workplace-team-save-preference"
                  disabled={
                    !ready ||
                    busy ||
                    !capabilities.canUpdateWorkplaceBooking ||
                    (consent.optIn &&
                      (!overview.policy.sharingEnabled || preferredVisibility === 'PRIVATE'))
                  }
                  onClick={() =>
                    submit({
                      scopeKey,
                      kind: 'preference',
                      input: {
                        optIn: consent.optIn,
                        visibility: consent.optIn ? preferredVisibility : 'PRIVATE',
                        version: overview.preference.version,
                      },
                    })
                  }
                >
                  {t('workplace.member.team.savePreference')}
                </ActionButton>
                {overview.preference.optIn ? (
                  <ActionButton
                    intent="danger"
                    data-testid="workplace-team-revoke"
                    disabled={!ready || busy || !capabilities.canUpdateWorkplaceBooking}
                    onClick={() => setConfirmingRevoke(scopeKey)}
                  >
                    {t('workplace.member.team.revoke')}
                  </ActionButton>
                ) : null}
              </Stack>
            </Box>
            <Box
              component="section"
              sx={(theme) => ({
                ...workplaceMemberCard(theme),
                gridArea: { xs: 'week', lg: 'ownWeek' },
              })}
            >
              <WorkplaceHomeSectionHeader
                id="workplace-team-week"
                icon={CalendarDays}
                title={t('workplace.member.team.week')}
                description={`${dateLabel(week.from)} – ${dateLabel(week.to)}`}
              />
              <Stack component="ul" spacing={1} sx={{ px: 2, pb: 2, m: 0, listStyle: 'none' }}>
                {week.days
                  .filter(
                    (date) =>
                      Temporal.PlainDate.from(date).dayOfWeek <= 5 ||
                      date === draft.date ||
                      overview.ownPlans.some((plan) => plan.planDate === date)
                  )
                  .map((date) => {
                    const plan = overview.ownPlans.find((candidate) => candidate.planDate === date);
                    return (
                      <Box component="li" key={date}>
                        <ButtonBase
                          disabled={busy}
                          onClick={() => selectDate(date)}
                          aria-pressed={date === draft.date}
                          sx={(theme) => ({
                            ...workplaceMemberSoftSurface(theme),
                            width: 1,
                            p: 1,
                            display: 'grid',
                            gridTemplateColumns: '58px minmax(0, 1fr)',
                            gap: 1.25,
                            textAlign: 'left',
                            border: 1,
                            borderColor: date === draft.date ? 'primary.main' : 'transparent',
                            '&:focus-visible': {
                              outline: '2px solid',
                              outlineColor: 'primary.main',
                            },
                          })}
                        >
                          <Typography variant="caption" fontWeight="fontWeightBold">
                            {dateLabel(date)}
                          </Typography>
                          <Stack spacing={0.35} minWidth={0}>
                            <Typography variant="body2" fontWeight="fontWeightBold">
                              {plan
                                ? t(`workplace.member.team.modes.${plan.mode}`)
                                : t('workplace.member.team.ownEmpty')}
                            </Typography>
                            {plan ? (
                              <Typography variant="caption" color="text.secondary">
                                {locationLabel(plan)} ·{' '}
                                {t(`workplace.member.team.visibilities.${plan.visibility}`)}
                              </Typography>
                            ) : null}
                          </Stack>
                        </ButtonBase>
                      </Box>
                    );
                  })}
              </Stack>
            </Box>
            <Box
              component="section"
              data-testid="workplace-team-plan-form"
              sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2.5, gridArea: 'plan' })}
            >
              <Stack spacing={2}>
                <Typography component="h2" variant="h6">
                  {t('workplace.member.team.save')}
                </Typography>
                <DatePickerField
                  size="small"
                  label={t('workplace.member.team.planDate')}
                  value={draft.date}
                  disabled={busy}
                  onValueChange={(date) => date && selectDate(date)}
                />
                <SelectField
                  size="small"
                  label={t('workplace.member.team.mode')}
                  value={draft.mode}
                  disabled={busy}
                  options={(['OFFICE', 'REMOTE', 'OFF'] as const).map((mode) => ({
                    value: mode,
                    label: t(`workplace.member.team.modes.${mode}`),
                  }))}
                  onValueChange={(mode) => updateDraft({ mode: mode as WorkplaceWorkMode })}
                />
                {draft.mode === 'OFFICE' ? (
                  <>
                    {catalogState !== 'READY' ? (
                      <InlineFeedback severity="warning">
                        {t('workplace.partialWarning')}
                      </InlineFeedback>
                    ) : null}
                    <SelectField
                      size="small"
                      label={t('workplace.explore.site')}
                      value={siteId}
                      disabled={busy || catalogState !== 'READY'}
                      options={(catalog?.sites ?? []).map((site) => ({
                        value: site.siteId,
                        label: site.name,
                      }))}
                      onValueChange={(value) =>
                        updateDraft({
                          siteId: String(value),
                          floorId:
                            catalog?.floors.find((floor) => floor.siteId === value)?.floorId ?? '',
                          resourceId: '',
                        })
                      }
                    />
                    <SelectField
                      size="small"
                      label={t('workplace.explore.floor')}
                      value={floorId}
                      disabled={busy || catalogState !== 'READY'}
                      options={floors.map((floor) => ({
                        value: floor.floorId,
                        label: floor.name,
                      }))}
                      onValueChange={(value) =>
                        updateDraft({ floorId: String(value), resourceId: '' })
                      }
                    />
                    <SelectField
                      size="small"
                      label={t('workplace.my.relocate.resource')}
                      value={draft.resourceId}
                      disabled={busy || catalogState !== 'READY'}
                      options={[
                        { value: '', label: t('workplace.member.team.visibilities.SITE') },
                        ...resources.map((resource) => ({
                          value: resource.resourceId,
                          label: resource.name,
                        })),
                      ]}
                      onValueChange={(value) => updateDraft({ resourceId: String(value) })}
                    />
                  </>
                ) : null}
                <SelectField
                  size="small"
                  label={t('workplace.member.team.visibility')}
                  value={visibility}
                  disabled={busy || !ready}
                  options={visibilityChoices.map((value) => ({
                    value,
                    label: t(`workplace.member.team.visibilities.${value}`),
                  }))}
                  onValueChange={(value) =>
                    updateDraft({ visibility: value as WorkplaceSharingVisibility })
                  }
                />
                {visibility !== 'PRIVATE' ? (
                  <SelectField
                    size="small"
                    label={t('workplace.member.team.group')}
                    value={
                      groups.some((group) => group.groupRef === draft.groupRef)
                        ? draft.groupRef
                        : (groups[0]?.groupRef ?? '')
                    }
                    disabled={busy || !ready}
                    options={groups.map((group, index) => ({
                      value: group.groupRef,
                      label:
                        group.displayName ||
                        t('workplace.member.team.groupLabel', { number: index + 1 }),
                    }))}
                    onValueChange={(value) => updateDraft({ groupRef: String(value) })}
                  />
                ) : null}
                <ActionButton
                  intent="primary"
                  data-testid="workplace-team-save-plan"
                  disabled={!canSavePlan}
                  loading={busy && mutation.variables?.kind === 'plan'}
                  onClick={() =>
                    submit({
                      scopeKey,
                      kind: 'plan',
                      input: {
                        planDate: draft.date,
                        mode: draft.mode,
                        siteId: draft.mode === 'OFFICE' ? siteId : null,
                        floorId: draft.mode === 'OFFICE' ? floorId || null : null,
                        resourceId: draft.mode === 'OFFICE' ? draft.resourceId || null : null,
                        groupRef:
                          visibility === 'PRIVATE'
                            ? null
                            : draft.groupRef || groups[0]?.groupRef || null,
                        visibility,
                        version: currentPlan?.version ?? null,
                      },
                    })
                  }
                >
                  {t('workplace.member.team.save')}
                </ActionButton>
                {currentPlan ? (
                  <ActionButton
                    intent="danger"
                    disabled={!ready || busy || !capabilities.canUpdateWorkplaceBooking}
                    onClick={() =>
                      submit({
                        scopeKey,
                        kind: 'remove',
                        planId: currentPlan.planId,
                        version: currentPlan.version,
                      })
                    }
                  >
                    {t('workplace.member.team.remove')}
                  </ActionButton>
                ) : null}
              </Stack>
            </Box>
            <Box
              component="section"
              sx={(theme) => ({
                ...workplaceMemberCard(theme),
                gridArea: { xs: 'shared', lg: 'matrix' },
              })}
            >
              <WorkplaceHomeSectionHeader
                id="workplace-team-shared"
                icon={UsersRound}
                title={t('workplace.member.team.shared')}
                description={t('workplace.member.team.planned')}
              />
              {sharedPlans.length ? (
                <>
                  <Box
                    role="region"
                    aria-label={t('workplace.member.team.matrixCaption')}
                    tabIndex={0}
                    sx={{ display: { xs: 'none', lg: 'block' }, px: 1, pb: 1, overflowX: 'auto' }}
                  >
                    <WorkplaceSharedPlanMatrix
                      plans={sharedPlans}
                      days={week.days}
                      today={today}
                      dateLabel={dateLabel}
                      locationLabel={locationLabel}
                      discoveryAction={sharedDiscoveryAction}
                    />
                  </Box>
                  <Stack
                    component="ul"
                    spacing={1}
                    sx={{
                      display: { xs: 'flex', lg: 'none' },
                      px: 2,
                      pb: 2,
                      m: 0,
                      listStyle: 'none',
                    }}
                  >
                    {sharedPlans.map((plan) => (
                      <Stack
                        component="li"
                        key={plan.planId}
                        spacing={0.5}
                        sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          gap={1}
                          flexWrap="wrap"
                        >
                          <Typography fontWeight="fontWeightBold" variant="body2">
                            {plan.displayName || t('workplace.member.team.anonymousPlan')}
                          </Typography>
                          <Chip size="small" label={dateLabel(plan.planDate)} />
                        </Stack>
                        <Stack direction="row" gap={0.75} alignItems="flex-start">
                          <MapPin size={15} aria-hidden="true" />
                          <Typography variant="body2">{locationLabel(plan)}</Typography>
                        </Stack>
                        {sharedDiscoveryAction(plan)}
                      </Stack>
                    ))}
                  </Stack>
                </>
              ) : overviewState !== 'READY' ? (
                <InlineFeedback severity="warning" sx={{ m: 2 }}>
                  {t('workplace.staleWarning')}
                </InlineFeedback>
              ) : (
                <EmptyState
                  icon={<UsersRound size={24} />}
                  title={t('workplace.member.team.empty')}
                  description={t('workplace.member.team.sharingDescription')}
                />
              )}
            </Box>
          </Box>
          <Box
            component="section"
            sx={(theme) => ({ ...workplaceMemberCard(theme), mt: 2, p: { xs: 1.5, md: 2.5 } })}
          >
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
              <ShieldCheck size={19} aria-hidden="true" />
              <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                {t('workplace.member.team.sharingDescription')}
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <WorkplaceTeamSourceCard
                eyebrow={t('workplace.home.sources.workspace')}
                title={t('workplace.member.team.planned')}
                description={t('workplace.member.team.presenceNotice')}
              />
              <WorkplaceTeamSourceCard
                eyebrow={t('workplace.home.status.verifiedAt', {
                  time: formatDate(
                    overview.generatedAt,
                    { hour: '2-digit', minute: '2-digit' },
                    locale
                  ),
                })}
                title={t('workplace.member.team.matrixCaption')}
                description={t('workplace.member.team.sharingDescription')}
              />
              <WorkplaceTeamSourceCard
                eyebrow={t('workplace.experience.connectorKinds.ACTUAL_PRESENCE')}
                title={t('workplace.home.sources.externalPresence')}
                description={t(
                  `workplace.experience.connectorStatuses.${overview.actualPresence.status}`
                )}
              />
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            {t('workplace.home.status.verifiedAt', {
              time: formatDate(
                overview.generatedAt,
                { hour: '2-digit', minute: '2-digit' },
                locale
              ),
            })}
          </Typography>
        </>
      ) : null}
      <ConfirmDialog
        open={confirmingRevoke === scopeKey && ready}
        title={t('workplace.member.team.revokeTitle')}
        description={t('workplace.member.team.revokeDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('workplace.member.team.revoke')}
        busy={busy}
        intent="danger"
        minimumActionHeight={44}
        focusCancelAfterOpen
        onClose={() => setConfirmingRevoke(null)}
        onConfirm={() =>
          overview && submit({ scopeKey, kind: 'revoke', version: overview.preference.version })
        }
      />
    </PageCanvas>
  );
}
