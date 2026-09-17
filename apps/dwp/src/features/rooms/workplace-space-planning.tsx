import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  createWorkplaceIdempotencyKey,
  getWorkplaceAdminFloors,
  getWorkplaceAdminSites,
  resolveIdempotentMutationIntent,
  usePermissions,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import {
  approveWorkplacePlanningScenario,
  createWorkplacePlanningScenario,
  getWorkplacePlanningOverview,
  previewWorkplacePlanningBookingImpact,
  previewWorkplacePlanningScenario,
  publishWorkplacePlanningScenario,
  submitWorkplacePlanningScenario,
  updateWorkplacePlanningScenario,
} from '@dwp-frontend/shared-utils/api/workplace-planning-api';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { RoomsPageHeading } from './rooms-ui';
import { useRoomsCapabilities } from './rooms-capabilities';
import {
  buildWorkplacePlanningScope,
  defaultWorkplacePlanningScopeForm,
  isWorkplacePlanningPreviewSubmittable,
  parseWorkplacePlanningUrl,
  workplacePlanningScenarioSnapshotsEqual,
  workplacePlanningScopesEqual,
  workplacePlanningSearchParams,
} from './workplace-space-planning-model';
import { loadWorkplacePlanningResources } from './workplace-space-planning-resources';
import { WorkplaceSpacePlanningScope } from './workplace-space-planning-scope';
import { WorkplaceSpacePlanningOverview } from './workplace-space-planning-overview';
import { WorkplaceSpacePlanningScenarioList } from './workplace-space-planning-scenario-list';
import {
  WorkplaceSpacePlanningEditor,
  type WorkplacePlanningEditorSubmission,
} from './workplace-space-planning-editor';
import {
  WorkplaceSpacePlanningBookingImpact,
  WorkplaceSpacePlanningComparison,
} from './workplace-space-planning-impact';
import { WorkplaceSpacePlanningCommandFeedback } from './workplace-space-planning-command-feedback';
import { WorkplaceSpacePlanningBoardReport } from './workplace-space-planning-board-report';

import type { IdempotentMutationIntent } from '@dwp-frontend/shared-utils';
import type {
  WorkplacePlanningBookingImpact,
  WorkplacePlanningCommandResult,
  WorkplacePlanningOverview as WorkplacePlanningOverviewData,
  WorkplacePlanningScenario,
  WorkplacePlanningScope,
} from '@dwp-frontend/shared-utils/api/workplace-planning-contract';

type CommandOutcome =
  | Readonly<{ kind: 'scenario'; value: WorkplacePlanningCommandResult }>
  | Readonly<{
      kind: 'impact';
      value: Awaited<ReturnType<typeof previewWorkplacePlanningBookingImpact>>;
    }>;

type PreparedPlanningCommand = Readonly<{
  submission: WorkplacePlanningEditorSubmission;
  scenario: WorkplacePlanningScenario | null;
  scope: WorkplacePlanningScope;
  expectedVersion: number;
  idempotencyKey: string;
}>;

function scopeKey(scope: WorkplacePlanningScope | null) {
  return scope
    ? [scope.siteId, scope.floorId, scope.neighborhood, scope.resourceType, scope.from, scope.to]
    : [];
}

export function WorkplaceSpacePlanning() {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const capabilities = useRoomsCapabilities();
  const permissions = usePermissions();
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUrl = useRef(parseWorkplacePlanningUrl(searchParams));
  const canView = capabilities.canViewWorkplaceAdmin;
  const canManage = capabilities.canManageWorkplaceAdmin;
  const canApprove = permissions.hasPermission('ADMIN.WORKPLACE', 'APPROVE');
  const canExport = permissions.hasPermission('ADMIN.WORKPLACE', 'EXPORT');
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const decisionRevision = authority.snapshot?.envelope.decisionRevision ?? '';
  const [scopeForm, setScopeForm] = useState(initialUrl.current.form);
  const [appliedForm, setAppliedForm] = useState(initialUrl.current.form);
  const [appliedScope, setAppliedScope] = useState<WorkplacePlanningScope | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    initialUrl.current.scenarioId
  );
  const [creating, setCreating] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [impact, setImpact] = useState<WorkplacePlanningBookingImpact | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WorkplacePlanningCommandResult['receipt'] | null>(
    null
  );
  const [recovering, setRecovering] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const lastCommandRef = useRef<PreparedPlanningCommand | null>(null);
  const unknownScenarioRef = useRef<WorkplacePlanningScenario | null>(null);
  const recoveryReplayRef = useRef(false);
  const scopeInitializedRef = useRef(false);

  useEffect(() => {
    if (!initialUrl.current.corrected) return;
    setSearchParams(initialUrl.current.canonicalSearchParams, { replace: true });
  }, [setSearchParams]);

  const sitesQuery = useQuery({
    queryKey: ['workplace', 'space-planning', 'sites'],
    queryFn: getWorkplaceAdminSites,
    enabled: capabilities.isLoaded && canView,
    staleTime: 60_000,
    retry: false,
  });
  const selectedSite = sitesQuery.data?.find((site) => site.siteId === scopeForm.siteId) ?? null;
  const siteTimeZone = selectedSite?.timeZone ?? null;
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'space-planning', 'floors', scopeForm.siteId],
    queryFn: () => getWorkplaceAdminFloors(scopeForm.siteId),
    enabled: canView && Boolean(scopeForm.siteId),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    const first = sitesQuery.data?.[0];
    if (!first || scopeInitializedRef.current) return;
    const requested = sitesQuery.data?.find((site) => site.siteId === scopeForm.siteId) ?? first;
    const initialForm =
      requested.siteId === scopeForm.siteId
        ? scopeForm
        : {
            ...defaultWorkplacePlanningScopeForm(new Date(), requested.timeZone),
            siteId: requested.siteId,
          };
    if (initialForm.floorId && !floorsQuery.data && !floorsQuery.isError) return;
    const validatedForm =
      initialForm.floorId &&
      !floorsQuery.data?.some((floor) => floor.floorId === initialForm.floorId)
        ? { ...initialForm, floorId: '' }
        : initialForm;
    const initialScope = buildWorkplacePlanningScope(validatedForm, requested.timeZone);
    scopeInitializedRef.current = true;
    setScopeForm(validatedForm);
    setAppliedForm(validatedForm);
    setAppliedScope(initialScope);
    setSearchParams(workplacePlanningSearchParams(validatedForm, selectedScenarioId), {
      replace: true,
    });
  }, [
    floorsQuery.data,
    floorsQuery.isError,
    scopeForm,
    selectedScenarioId,
    setSearchParams,
    sitesQuery.data,
  ]);

  const candidateScope = useMemo(
    () => buildWorkplacePlanningScope(scopeForm, siteTimeZone ?? 'UTC'),
    [scopeForm, siteTimeZone]
  );
  const overviewQuery = useQuery({
    queryKey: ['workplace', 'space-planning', 'overview', ...scopeKey(appliedScope)],
    queryFn: () => getWorkplacePlanningOverview(appliedScope!),
    enabled: canView && Boolean(appliedScope),
    staleTime: 15_000,
    retry: false,
  });
  const overview = workplacePlanningScopesEqual(overviewQuery.data?.scope ?? null, appliedScope)
    ? overviewQuery.data!
    : null;
  const scopedScenarios = useMemo(
    () =>
      overview?.scenarios.filter((scenario) =>
        workplacePlanningScopesEqual(scenario.scope, appliedScope)
      ) ?? [],
    [appliedScope, overview]
  );
  const selectedScenario =
    scopedScenarios.find((scenario) => scenario.scenarioId === selectedScenarioId) ?? null;
  const resourceScope = selectedScenario?.scope ?? appliedScope;
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'space-planning', 'resources', ...scopeKey(resourceScope)],
    queryFn: () => loadWorkplacePlanningResources(resourceScope!),
    enabled: canView && Boolean(resourceScope),
    staleTime: 30_000,
    retry: false,
  });
  const appliedSite = sitesQuery.data?.find((site) => site.siteId === appliedScope?.siteId) ?? null;
  const appliedTimeZone = appliedSite?.timeZone ?? 'UTC';
  const recoveryBlocked = lastReceipt?.state === 'RESULT_UNKNOWN';

  useEffect(() => {
    const first = scopedScenarios[0];
    if (creating || !first) return;
    if (scopedScenarios.some((scenario) => scenario.scenarioId === selectedScenarioId)) return;
    setSelectedScenarioId(first.scenarioId);
    setSearchParams(workplacePlanningSearchParams(appliedForm, first.scenarioId), {
      replace: true,
    });
  }, [appliedForm, creating, scopedScenarios, selectedScenarioId, setSearchParams]);

  const mutation = useMutation<CommandOutcome, Error, PreparedPlanningCommand>({
    mutationFn: async (command) => {
      if (recoveryBlocked && !recoveryReplayRef.current) {
        throw new Error('Authoritative recovery is required.');
      }
      const { submission, scenario, scope: commandScope, expectedVersion } = command;
      if (
        (submission.action === 'CREATE' || submission.action === 'UPDATE') &&
        !resourcesQuery.isSuccess
      ) {
        throw new Error('The authoritative resource catalog is unavailable.');
      }
      if (
        submission.action === 'SUBMIT' &&
        !recoveryReplayRef.current &&
        (!scenario || !isWorkplacePlanningPreviewSubmittable(scenario, Date.now()))
      ) {
        throw new Error('The scenario preview is stale, incomplete, or ineligible.');
      }
      const options = { idempotencyKey: command.idempotencyKey };
      const elevatedOptions = { ...options, activeAccessMode: 'ELEVATED' as const };
      const reason = submission.form.reason.trim();
      const transition = { expectedVersion, reason, explicitConfirmation: true as const };
      if (submission.action === 'CREATE') {
        if (!submission.draft) throw new Error('Scenario draft is invalid.');
        const value = await createWorkplacePlanningScenario(
          {
            name: submission.form.name.trim(),
            description: submission.form.description.trim() || null,
            scope: commandScope,
            draft: submission.draft,
            reason,
            explicitConfirmation: true,
          },
          options
        );
        return { kind: 'scenario', value };
      }
      if (!scenario) throw new Error('Scenario selection is unavailable.');
      if (submission.action === 'UPDATE') {
        if (!submission.draft) throw new Error('Scenario draft is invalid.');
        return {
          kind: 'scenario',
          value: await updateWorkplacePlanningScenario(
            scenario.scenarioId,
            {
              expectedVersion,
              name: submission.form.name.trim(),
              description: submission.form.description.trim() || null,
              draft: submission.draft,
              reason,
              explicitConfirmation: true,
            },
            options
          ),
        };
      }
      if (submission.action === 'PREVIEW') {
        return {
          kind: 'scenario',
          value: await previewWorkplacePlanningScenario(scenario.scenarioId, transition, options),
        };
      }
      if (submission.action === 'BOOKING_IMPACT') {
        return {
          kind: 'impact',
          value: await previewWorkplacePlanningBookingImpact(
            scenario.scenarioId,
            transition,
            options
          ),
        };
      }
      if (submission.action === 'SUBMIT') {
        return {
          kind: 'scenario',
          value: await submitWorkplacePlanningScenario(
            scenario.scenarioId,
            transition,
            elevatedOptions
          ),
        };
      }
      if (submission.action === 'APPROVE' || submission.action === 'REJECT') {
        return {
          kind: 'scenario',
          value: await approveWorkplacePlanningScenario(
            scenario.scenarioId,
            {
              ...transition,
              decision: submission.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
              approvalAuthorityReference: submission.form.approvalAuthorityReference.trim(),
            },
            elevatedOptions
          ),
        };
      }
      return {
        kind: 'scenario',
        value: await publishWorkplacePlanningScenario(
          scenario.scenarioId,
          transition,
          elevatedOptions
        ),
      };
    },
    retry: false,
    onMutate: (command) => {
      lastCommandRef.current = command;
      setImpact(null);
    },
    onSuccess: (outcome) => {
      const receipt = outcome.value.receipt;
      if (receipt.state !== 'RESULT_UNKNOWN') {
        intentRef.current = null;
        lastCommandRef.current = null;
        unknownScenarioRef.current = null;
      } else {
        unknownScenarioRef.current = outcome.kind === 'scenario' ? outcome.value.scenario : null;
      }
      setRecoveryChecked(false);
      setLastReceipt(receipt);
      if (outcome.kind === 'impact') {
        setImpact(receipt.state === 'SUCCEEDED' ? outcome.value.preview : null);
      } else if (receipt.state === 'SUCCEEDED') {
        const authoritativeScenario = outcome.value.scenario;
        queryClient.setQueryData<WorkplacePlanningOverviewData>(
          ['workplace', 'space-planning', 'overview', ...scopeKey(authoritativeScenario.scope)],
          (current) => {
            if (
              !current ||
              !workplacePlanningScopesEqual(current.scope, authoritativeScenario.scope)
            ) {
              return current;
            }
            const exists = current.scenarios.some(
              (scenario) => scenario.scenarioId === authoritativeScenario.scenarioId
            );
            return {
              ...current,
              scenarios: exists
                ? current.scenarios.map((scenario) =>
                    scenario.scenarioId === authoritativeScenario.scenarioId
                      ? authoritativeScenario
                      : scenario
                  )
                : [...current.scenarios, authoritativeScenario],
            };
          }
        );
        setCreating(false);
        setSelectedScenarioId(authoritativeScenario.scenarioId);
        setSearchParams(
          workplacePlanningSearchParams(appliedForm, authoritativeScenario.scenarioId),
          { replace: true }
        );
        setEditorEpoch((value) => value + 1);
      }
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'space-planning', 'overview'] });
    },
    onSettled: () => {
      recoveryReplayRef.current = false;
    },
  });

  const runCommand = (submission: WorkplacePlanningEditorSubmission) => {
    if (!appliedScope || recoveryBlocked) return;
    const scenario = selectedScenario;
    const commandScope = scenario?.scope ?? appliedScope;
    const expectedVersion = scenario?.version ?? 0;
    const intent = resolveIdempotentMutationIntent(
      intentRef.current,
      {
        action: submission.action,
        scenarioId: scenario?.scenarioId ?? null,
        expectedVersion,
        form: submission.form,
        draft: submission.draft,
        scope: commandScope,
      },
      () => createWorkplaceIdempotencyKey(`space-planning-${submission.action.toLowerCase()}`)
    );
    intentRef.current = intent;
    mutation.mutate({
      submission,
      scenario,
      scope: commandScope,
      expectedVersion,
      idempotencyKey: intent.key,
    });
  };

  const recoverUnknown = async () => {
    if (!recoveryBlocked || recovering) return;
    setRecovering(true);
    try {
      const result = await overviewQuery.refetch();
      const target = lastReceipt;
      const snapshot = unknownScenarioRef.current;
      const candidate = result.data?.scenarios.find(
        (scenario) => scenario.scenarioId === target?.scenarioId
      );
      const reconciled =
        result.data &&
        target &&
        snapshot &&
        candidate &&
        target.commandType !== 'BOOKING_IMPACT_PREVIEW' &&
        workplacePlanningScopesEqual(result.data.scope, appliedScope) &&
        candidate.state === target.scenarioState &&
        candidate.version === target.scenarioVersion &&
        workplacePlanningScenarioSnapshotsEqual(candidate, snapshot);
      if (reconciled) {
        intentRef.current = null;
        lastCommandRef.current = null;
        unknownScenarioRef.current = null;
        setLastReceipt(null);
        setImpact(null);
        setEditorEpoch((value) => value + 1);
      } else if (result.data) {
        setRecoveryChecked(true);
      }
    } finally {
      setRecovering(false);
    }
  };

  const replayUnknown = () => {
    const command = lastCommandRef.current;
    if (!recoveryBlocked || !recoveryChecked || !command || mutation.isPending) return;
    recoveryReplayRef.current = true;
    mutation.mutate(command);
  };

  const applyScope = () => {
    if (!candidateScope || recoveryBlocked) return;
    setAppliedScope(candidateScope);
    setAppliedForm(scopeForm);
    setSelectedScenarioId(null);
    setCreating(false);
    setImpact(null);
    setLastReceipt(null);
    setSearchParams(workplacePlanningSearchParams(scopeForm, null), { replace: true });
  };
  const selectScenario = (scenarioId: string) => {
    if (recoveryBlocked) return;
    setCreating(false);
    setSelectedScenarioId(scenarioId);
    setImpact(null);
    setLastReceipt(null);
    setSearchParams(workplacePlanningSearchParams(appliedForm, scenarioId), { replace: true });
    setEditorEpoch((value) => value + 1);
  };
  const startCreate = () => {
    if (recoveryBlocked) return;
    setCreating(true);
    setSelectedScenarioId(null);
    setImpact(null);
    setLastReceipt(null);
    setSearchParams(workplacePlanningSearchParams(appliedForm, null), { replace: true });
    setEditorEpoch((value) => value + 1);
  };

  if (!capabilities.isLoaded || sitesQuery.isLoading) {
    return (
      <PageCanvas>
        <LoadingState
          label={t('workplace.spacePlanning.states.loading')}
          variant="skeleton"
          skeletonRows={4}
          skeletonHeight={96}
        />
      </PageCanvas>
    );
  }
  if (!canView) {
    return (
      <PageCanvas>
        <EmptyState
          icon={<ShieldCheck size={30} />}
          title={t('workplace.spacePlanning.states.deniedTitle')}
          description={t('workplace.spacePlanning.states.deniedDescription')}
        />
      </PageCanvas>
    );
  }

  const resourceCatalogStatus = resourcesQuery.isError
    ? 'error'
    : resourcesQuery.isSuccess
      ? 'ready'
      : 'loading';
  const visibleImpact =
    impact &&
    selectedScenario &&
    impact.scenarioId === selectedScenario.scenarioId &&
    impact.scenarioVersion === selectedScenario.version &&
    Date.parse(impact.expiresAt) > Date.now()
      ? impact
      : null;
  return (
    <PageCanvas topInset="compact">
      <RoomsPageHeading
        eyebrow={t('workplace.spacePlanning.eyebrow')}
        title={t('workplace.spacePlanning.title')}
        description={t('workplace.spacePlanning.description')}
        actions={
          <ActionButton
            intent="secondary"
            startIcon={<RefreshCw size={16} />}
            disabled={!appliedScope || overviewQuery.isFetching}
            onClick={() => void overviewQuery.refetch()}
          >
            {t('workplace.spacePlanning.refresh')}
          </ActionButton>
        }
      />
      {sitesQuery.isError ? (
        <InlineFeedback
          severity="error"
          icon={<TriangleAlert size={17} />}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void sitesQuery.refetch()}>
              {t('workplace.spacePlanning.retry')}
            </ActionButton>
          }
        >
          {t('workplace.spacePlanning.states.sitesError')}
        </InlineFeedback>
      ) : !sitesQuery.data?.length ? (
        <EmptyState
          title={t('workplace.spacePlanning.states.noSites')}
          description={t('workplace.spacePlanning.states.noSitesDescription')}
        />
      ) : (
        <Stack gap={2}>
          <WorkplaceSpacePlanningScope
            form={scopeForm}
            sites={sitesQuery.data}
            floors={floorsQuery.data ?? []}
            timeZone={siteTimeZone}
            invalid={!candidateScope}
            refreshing={overviewQuery.isFetching}
            blocked={recoveryBlocked}
            onChange={(key, value) => {
              setScopeForm((current) => ({
                ...current,
                [key]: value,
                ...(key === 'siteId' ? { floorId: '' } : {}),
              }));
            }}
            onApply={applyScope}
          />
          {floorsQuery.isError ? (
            <InlineFeedback severity="warning">
              {t('workplace.spacePlanning.states.floorCatalogError')}
            </InlineFeedback>
          ) : null}
          {overviewQuery.isError ? (
            <InlineFeedback
              severity="error"
              action={
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => void overviewQuery.refetch()}
                >
                  {t('workplace.spacePlanning.retry')}
                </ActionButton>
              }
            >
              {t('workplace.spacePlanning.states.overviewError')}
            </InlineFeedback>
          ) : null}
          {appliedScope && !overview && !overviewQuery.isError ? (
            <LoadingState
              label={t('workplace.spacePlanning.states.loadingOverview')}
              variant="skeleton"
              skeletonRows={5}
              skeletonHeight={84}
              embedded
            />
          ) : overview ? (
            <>
              <WorkplaceSpacePlanningOverview
                overview={overview}
                locale={locale}
                timeZone={appliedTimeZone}
                refreshing={overviewQuery.isFetching}
                onRefresh={() => void overviewQuery.refetch()}
              />
              {resourcesQuery.isError ? (
                <InlineFeedback severity="warning">
                  {t('workplace.spacePlanning.states.resourceCatalogError')}
                </InlineFeedback>
              ) : null}
              <WorkplaceSpacePlanningCommandFeedback
                error={mutation.error}
                receipt={lastReceipt}
                recovering={recovering}
                pending={mutation.isPending}
                recoveryChecked={recoveryChecked}
                onRecover={() => void recoverUnknown()}
                onReplay={replayUnknown}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    xl: 'minmax(250px, 0.72fr) minmax(0, 1.55fr)',
                  },
                  gap: 2,
                  alignItems: 'start',
                }}
              >
                <WorkplaceSpacePlanningScenarioList
                  scenarios={scopedScenarios}
                  selectedId={creating ? null : selectedScenarioId}
                  canManage={canManage}
                  blocked={recoveryBlocked}
                  locale={locale}
                  timeZone={appliedTimeZone}
                  onSelect={selectScenario}
                  onCreate={startCreate}
                />
                {(creating || selectedScenario) && (
                  <Stack gap={2} minWidth={0}>
                    <WorkplaceSpacePlanningEditor
                      key={`${creating ? 'new' : selectedScenario?.scenarioId}-${editorEpoch}`}
                      scenario={creating ? null : selectedScenario}
                      current={overview.current}
                      resources={resourcesQuery.data ?? []}
                      emission={overview.emission}
                      canManage={canManage}
                      canApprove={canApprove}
                      elevated={elevated}
                      resourceCatalogStatus={resourceCatalogStatus}
                      commandBlocked={recoveryBlocked}
                      pending={mutation.isPending || recovering}
                      onSubmit={runCommand}
                    />
                    {!creating && selectedScenario?.activePreview ? (
                      <WorkplaceSpacePlanningComparison
                        preview={selectedScenario.activePreview}
                        locale={locale}
                        timeZone={appliedTimeZone}
                      />
                    ) : null}
                    {!creating && selectedScenario ? (
                      <WorkplaceSpacePlanningBoardReport
                        scenario={selectedScenario}
                        siteId={selectedScenario.scope.siteId}
                        canExport={canExport}
                        elevated={elevated}
                        decisionRevision={decisionRevision}
                        locale={locale}
                        timeZone={appliedTimeZone}
                      />
                    ) : null}
                    {visibleImpact && !creating ? (
                      <WorkplaceSpacePlanningBookingImpact
                        impact={visibleImpact}
                        resources={resourcesQuery.data ?? []}
                        locale={locale}
                        timeZone={appliedTimeZone}
                      />
                    ) : null}
                  </Stack>
                )}
              </Box>
            </>
          ) : null}
        </Stack>
      )}
    </PageCanvas>
  );
}

export default WorkplaceSpacePlanning;
