import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Download, Gauge, Pencil, Plus } from 'lucide-react';
import { ActionButton, FormField, OperationalKpiStrip } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getDwaionOutcomes,
  type DwaionImprovementBacklogItem,
  type DwaionOutcomeMetric,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';
import {
  DwaionCanonicalCommandActions,
  type DwaionCanonicalCommandAction,
} from './dwaion-canonical-command-actions';
import {
  DwaionAdminQueryBoundary,
  DwaionAdminSection,
  DwaionCapabilityNotice,
  DwaionFreshness,
} from './dwaion-admin-advancement-ui';
import {
  DwaionBacklogDialog,
  DwaionBudgetDialog,
  DwaionCostSimulationDialog,
  type DwaionBacklogDraft,
  type DwaionBudgetDraft,
  type DwaionCostSimulationDraft,
} from './dwaion-outcomes-dialogs';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './dwaion-governed-command-dialog';

export function DwaionOutcomesOperationsPanel({ periodDays }: { periodDays: number }) {
  const copy = useDwaionAdminAdvancementCopy();
  const [scopeDraft, setScopeDraft] = useState({ organization: '', workType: '' });
  const [scope, setScope] = useState(scopeDraft);
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'outcomes', periodDays, scope],
    queryFn: () => getDwaionOutcomes(periodDays, scope),
    staleTime: 30_000,
  });
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  const [simulation, setSimulation] = useState<DwaionCostSimulationDraft | null>(null);
  const [backlog, setBacklog] = useState<DwaionBacklogDraft | null>(null);
  const [budget, setBudget] = useState<DwaionBudgetDraft | null>(null);
  const data = query.data;
  const commandsAvailable = data?.capability.status === 'AVAILABLE' && data.capability.configured;

  const requestExport = () => {
    if (!data) return;
    setIntent({
      title: copy.outcomes.export,
      description: copy.command.description,
      kind: 'OUTCOME_EXPORT',
      target: { type: 'OUTCOME_AGGREGATE', id: `period-${data.periodDays}` },
      expectedVersion: 0,
      changes: [
        { label: 'Period', before: 'No export', after: `${data.periodDays} days` },
        { label: 'Privacy threshold', before: 'Enforced', after: `${data.privacyThreshold}` },
      ],
      impacts: [
        'Aggregated metrics only',
        scope.organization || 'All authorized organizations',
        scope.workType || 'All authorized work types',
        `${data.suppressedCohortCount} suppressed cohorts`,
      ],
      recoveryPlan:
        'Expire the generated artifact and revoke its download reference while retaining the audit event.',
      payload: {
        periodDays: data.periodDays,
        organization: scope.organization || null,
        workType: scope.workType || null,
        privacyThreshold: data.privacyThreshold,
        format: 'CSV',
      },
    });
  };

  const submitSimulation = () => {
    if (!simulation || !data) return;
    setIntent({
      title: copy.outcomes.simulate,
      description: copy.command.description,
      kind: 'COST_SIMULATE',
      target: { type: 'COST_MODEL', id: simulation.candidateRoute.trim() },
      expectedVersion: 0,
      changes: [
        { label: 'Production budget', before: 'Unchanged', after: 'Dry-run only' },
        { label: 'Workload volume', before: '—', after: simulation.workloadVolume },
        { label: 'Route', before: simulation.currentRoute, after: simulation.candidateRoute },
      ],
      impacts: [
        `${data.periodDays}-day evidence window`,
        `Quality floor ${simulation.qualityFloor}%`,
        `Latency limit ${simulation.latencyLimitMs}ms`,
        `Cost limit ${simulation.costLimit} ${data.currency}`,
        simulation.expectedEffect,
        simulation.risks,
      ],
      recoveryPlan:
        'Cancel unfinished simulation workers; no production budget or route is changed.',
      payload: {
        workloadVolume: Number(simulation.workloadVolume),
        averageInputTokens: Number(simulation.averageInputTokens),
        averageOutputTokens: Number(simulation.averageOutputTokens),
        currentRoute: simulation.currentRoute.trim(),
        candidateRoute: simulation.candidateRoute.trim(),
        qualityFloor: Number(simulation.qualityFloor),
        latencyLimitMs: Number(simulation.latencyLimitMs),
        costLimit: Number(simulation.costLimit),
        expectedEffect: simulation.expectedEffect,
        risks: simulation.risks,
        currency: data.currency,
      },
    });
    setSimulation(null);
  };

  const submitBacklog = () => {
    if (!backlog) return;
    const current = data?.backlog.find((item) => item.itemId === backlog.itemId);
    const creating = !current;
    setIntent({
      title: creating ? copy.outcomes.createBacklog : copy.outcomes.backlog,
      description: copy.command.description,
      kind: creating ? 'BACKLOG_CREATE' : 'BACKLOG_UPDATE',
      target: { type: 'IMPROVEMENT_BACKLOG', id: backlog.itemId },
      expectedVersion: current?.version ?? 0,
      changes: [
        { label: 'Title', before: current?.title ?? '—', after: backlog.title },
        { label: 'State', before: current?.state ?? '—', after: backlog.state },
        { label: 'Priority', before: current?.priority ?? '—', after: backlog.priority },
        {
          label: 'Metric evidence',
          before: current?.metricEvidence ?? '—',
          after: backlog.metricEvidence,
        },
        {
          label: 'Problem cluster',
          before: current?.problemCluster ?? '—',
          after: backlog.problemCluster,
        },
        { label: 'Target', before: current?.targetValue ?? '—', after: backlog.targetValue },
        {
          label: 'Release',
          before: current?.linkedRelease ?? '—',
          after: backlog.linkedRelease || '—',
        },
        { label: 'Owner', before: current?.ownerTeam ?? '—', after: backlog.ownerTeam },
      ],
      impacts: [
        backlog.metricEvidence,
        backlog.ownerTeam,
        backlog.linkedRelease || 'No linked release',
      ],
      recoveryPlan: 'Restore the previous backlog version; metric evidence remains immutable.',
      payload: {
        title: backlog.title,
        priority: backlog.priority,
        metricEvidence: backlog.metricEvidence,
        state: backlog.state,
        problemCluster: backlog.problemCluster,
        targetValue: backlog.targetValue,
        linkedRelease: backlog.linkedRelease || null,
        ownerTeam: backlog.ownerTeam,
      },
    });
    setBacklog(null);
  };

  const submitBudget = () => {
    if (!budget) return;
    const current = data?.tokenBudgets.find((item) => item.scope === budget.scope);
    if (!current) return;
    setIntent({
      title: copy.outcomes.budget,
      description: copy.command.description,
      kind: 'TOKEN_BUDGET_UPDATE',
      target: { type: 'TOKEN_BUDGET', id: current.scope },
      expectedVersion: current.version,
      changes: [
        { label: 'Budget', before: String(current.budgetTokens), after: budget.budgetTokens },
        { label: 'Enforcement', before: current.policyMode, after: budget.policyMode },
      ],
      impacts: [
        current.scope,
        `${current.consumedTokens} tokens already consumed`,
        'Queued AI work',
      ],
      recoveryPlan:
        'Restore the prior limit and mode, then release throttled work only after usage validation.',
      payload: { budgetTokens: Number(budget.budgetTokens), policyMode: budget.policyMode },
      destructive:
        budget.policyMode === 'BLOCK' || Number(budget.budgetTokens) < current.budgetTokens,
    });
    setBudget(null);
  };

  return (
    <Box id="dwaion-outcomes-operations" sx={{ mt: 2.5, scrollMarginTop: 16 }}>
      <DwaionAdminQueryBoundary
        loading={query.isLoading}
        error={query.isError}
        fetching={query.isFetching}
        onRetry={() => void query.refetch()}
      >
        {data && (
          <Stack spacing={2}>
            <DwaionCapabilityNotice capability={data.capability} />
            <DwaionAdminSection
              title={copy.outcomes.title}
              description={copy.outcomes.description}
              actions={
                <DwaionFreshness
                  generatedAt={data.generatedAt}
                  fetching={query.isFetching}
                  onRefresh={() => void query.refetch()}
                />
              }
            >
              <Box
                component="form"
                aria-label={copy.ui.outcomes.drillDownScope}
                onSubmit={(event) => {
                  event.preventDefault();
                  setScope({
                    organization: scopeDraft.organization.trim(),
                    workType: scopeDraft.workType.trim(),
                  });
                }}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
                  gap: 1,
                  px: { xs: 1.5, md: 2 },
                  pt: 2,
                  alignItems: 'end',
                }}
              >
                <FormField
                  label={copy.ui.outcomes.organization}
                  value={scopeDraft.organization}
                  onChange={(event) =>
                    setScopeDraft({ ...scopeDraft, organization: event.target.value })
                  }
                />
                <FormField
                  label={copy.ui.outcomes.workType}
                  value={scopeDraft.workType}
                  onChange={(event) =>
                    setScopeDraft({ ...scopeDraft, workType: event.target.value })
                  }
                />
                <ActionButton type="submit" intent="secondary">
                  {copy.ui.outcomes.applyScope}
                </ActionButton>
              </Box>
              <OperationalKpiStrip
                ariaLabel={copy.ui.outcomes.summaryLabel}
                items={data.metrics.slice(0, 5).map((metric) => ({
                  key: metric.metricKey,
                  label: metric.label,
                  value: metricValue(metric, data.currency),
                  detail:
                    metric.denominator == null
                      ? `Denominator unavailable · ${formatDate(metric.freshnessAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}`
                      : `${copy.ui.common.sampleSizePrefix}${metric.denominator} · ${formatDate(
                          metric.freshnessAt,
                          { dateStyle: 'medium', timeStyle: 'short' }
                        )}`,
                  tone:
                    metric.unit === 'PERCENT' && (metric.value ?? 0) >= 90 ? 'success' : 'neutral',
                }))}
              />
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                gap={1}
                sx={{ px: { xs: 1.5, md: 2 }, pt: 2 }}
              >
                <ActionButton
                  intent="secondary"
                  startIcon={<Download size={16} />}
                  disabled={!commandsAvailable}
                  onClick={requestExport}
                >
                  {copy.outcomes.export}
                </ActionButton>
                <ActionButton
                  intent="secondary"
                  startIcon={<Calculator size={16} />}
                  disabled={!commandsAvailable}
                  onClick={() =>
                    setSimulation({
                      workloadVolume: '1000',
                      averageInputTokens: '1000',
                      averageOutputTokens: '500',
                      currentRoute: '',
                      candidateRoute: '',
                      qualityFloor: '90',
                      latencyLimitMs: '2000',
                      costLimit: '1000',
                      expectedEffect: '',
                      risks: '',
                    })
                  }
                >
                  {copy.outcomes.simulate}
                </ActionButton>
                <ActionButton
                  intent="primary"
                  startIcon={<Plus size={16} />}
                  disabled={!commandsAvailable}
                  onClick={() =>
                    setBacklog({
                      itemId: crypto.randomUUID(),
                      title: '',
                      priority: 'P2',
                      metricEvidence: '',
                      state: 'PROPOSED',
                      problemCluster: '',
                      targetValue: '',
                      linkedRelease: '',
                      ownerTeam: '',
                      version: 0,
                    })
                  }
                >
                  {copy.outcomes.createBacklog}
                </ActionButton>
                <Chip
                  variant="outlined"
                  label={`Privacy threshold ${data.privacyThreshold} · ${data.suppressedCohortCount} suppressed`}
                />
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    xl: 'minmax(0,7fr) minmax(20rem,5fr)',
                  },
                  gap: 2,
                  p: { xs: 1.5, md: 2 },
                }}
              >
                <Stack spacing={2}>
                  <Typography component="h3" variant="subtitle1">
                    {copy.ui.outcomes.cohortsDenominators}
                  </Typography>
                  <Box
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
                  >
                    {data.cohorts.map((cohort, index) => (
                      <Stack
                        key={cohort.cohortKey}
                        spacing={0.75}
                        sx={{ p: 1.5, borderTop: index ? 1 : 0, borderColor: 'divider' }}
                      >
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Typography variant="subtitle2">{cohort.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {copy.ui.common.sampleSizePrefix}
                            {cohort.completedWorkCount}
                          </Typography>
                        </Stack>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          <Chip
                            size="small"
                            label={`Complete ${percentage(cohort.completionRate)}`}
                          />
                          <Chip size="small" label={`Rework ${percentage(cohort.reworkRate)}`} />
                          <Chip
                            size="small"
                            label={`Rollback ${percentage(cohort.rollbackRate)}`}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Cost ${cohort.costPerCompletedWork == null ? '—' : formatNumber(cohort.costPerCompletedWork)} ${data.currency}`}
                          />
                        </Stack>
                      </Stack>
                    ))}
                  </Box>

                  <Typography component="h3" variant="subtitle1">
                    {copy.ui.outcomes.improvementBacklog}
                  </Typography>
                  <Stack divider={<Divider flexItem />}>
                    {data.backlog.map((item) => (
                      <Stack
                        key={item.itemId}
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        gap={1.25}
                        sx={{ py: 1.25 }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={item.priority} />
                            <Typography variant="subtitle2">{item.title}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {item.ownerTeam} · {item.problemCluster} · {item.metricEvidence} ·{' '}
                            {item.state} {copy.ui.common.versionSeparator}
                            {item.version}
                          </Typography>
                        </Box>
                        <ActionButton
                          intent="quiet"
                          startIcon={<Pencil size={15} />}
                          disabled={!commandsAvailable}
                          onClick={() =>
                            setBacklog({
                              itemId: item.itemId,
                              title: item.title,
                              priority: item.priority,
                              metricEvidence: item.metricEvidence,
                              state: item.state,
                              problemCluster: item.problemCluster,
                              targetValue: item.targetValue ?? '',
                              linkedRelease: item.linkedRelease ?? '',
                              ownerTeam: item.ownerTeam,
                              version: item.version,
                            })
                          }
                        >
                          {copy.outcomes.backlog}
                        </ActionButton>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>

                <Stack spacing={1.5}>
                  <Typography component="h3" variant="subtitle1">
                    {copy.ui.outcomes.tokenBudgets}
                  </Typography>
                  {data.tokenBudgets.map((item) => {
                    const usage = Math.min((item.consumedTokens / item.budgetTokens) * 100, 100);
                    return (
                      <Box
                        key={item.scope}
                        sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}
                      >
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Typography variant="subtitle2">{item.scope}</Typography>
                          <Chip
                            size="small"
                            color={item.spikeDetected ? 'warning' : 'default'}
                            label={item.policyMode}
                          />
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatNumber(item.consumedTokens)} / {formatNumber(item.budgetTokens)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={usage}
                          color={usage >= 90 ? 'warning' : 'primary'}
                          aria-label={`${item.scope} token budget usage`}
                          sx={{ mt: 0.75, height: 7, borderRadius: 999 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {copy.ui.common.projected}{' '}
                          {item.projectedTokens == null ? '—' : formatNumber(item.projectedTokens)}{' '}
                          {copy.ui.common.versionSeparator}
                          {item.version}
                        </Typography>
                        <ActionButton
                          intent="quiet"
                          startIcon={<Gauge size={15} />}
                          disabled={!commandsAvailable}
                          onClick={() =>
                            setBudget({
                              scope: item.scope,
                              budgetTokens: String(item.budgetTokens),
                              policyMode: item.policyMode,
                              version: item.version,
                            })
                          }
                        >
                          {copy.outcomes.budget}
                        </ActionButton>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </DwaionAdminSection>
            {data.backlog[0] && (
              <DwaionCanonicalCommandActions
                title={copy.ui.outcomes.deliveryOperations}
                description={copy.ui.outcomes.deliveryOperationsDescription}
                actions={backlogCanonicalActions(data.backlog[0], copy.command.description)}
                disabled={!commandsAvailable}
                onRefresh={async () => {
                  await query.refetch();
                }}
              />
            )}
          </Stack>
        )}
      </DwaionAdminQueryBoundary>

      <DwaionCostSimulationDialog
        value={simulation}
        onChange={setSimulation}
        onClose={() => setSimulation(null)}
        onSubmit={submitSimulation}
      />
      <DwaionBacklogDialog
        value={backlog}
        onChange={setBacklog}
        onClose={() => setBacklog(null)}
        onSubmit={submitBacklog}
      />
      <DwaionBudgetDialog
        value={budget}
        onChange={setBudget}
        onClose={() => setBudget(null)}
        onSubmit={submitBudget}
      />
      <DwaionGovernedCommandDialog
        intent={intent}
        onClose={() => setIntent(null)}
        onReconcile={async () => {
          await query.refetch();
        }}
        onCompleted={async () => {
          setIntent(null);
          await query.refetch();
        }}
      />
    </Box>
  );
}

function metricValue(metric: DwaionOutcomeMetric, currency: string) {
  if (metric.value == null) return '—';
  if (metric.unit === 'PERCENT') return `${metric.value.toFixed(1)}%`;
  if (metric.unit === 'MILLISECONDS') return `${formatNumber(metric.value)}ms`;
  if (metric.unit === 'CURRENCY') return `${formatNumber(metric.value)} ${currency}`;
  if (metric.unit === 'TOKENS') return `${formatNumber(metric.value)} tokens`;
  return formatNumber(metric.value);
}

function backlogCanonicalActions(
  item: DwaionImprovementBacklogItem,
  description: string
): DwaionCanonicalCommandAction[] {
  const common = {
    description,
    target: { type: 'IMPROVEMENT_BACKLOG', id: item.itemId },
    expectedVersion: item.version,
    impacts: [item.ownerTeam, item.metricEvidence, item.problemCluster],
    recoveryPlan:
      'Restore the prior backlog revision and remove the external link while preserving metric evidence and command history.',
  };
  return [
    {
      ...common,
      label: 'Open delivery ticket',
      title: 'Open backlog delivery ticket',
      kind: 'BACKLOG_TICKET_OPEN',
      changes: [{ label: 'Delivery ticket', before: 'Not linked', after: 'CREATE_PENDING' }],
      payload: {
        itemId: item.itemId,
        title: item.title,
        ownerTeam: item.ownerTeam,
        priority: item.priority,
        metricEvidence: item.metricEvidence,
        targetValue: item.targetValue,
      },
    },
    {
      ...common,
      label: 'Link release',
      title: 'Link improvement to release',
      kind: 'BACKLOG_RELEASE_LINK',
      changes: [
        {
          label: 'Linked release',
          before: item.linkedRelease ?? 'None',
          after: item.linkedRelease ?? 'Release selection pending',
        },
      ],
      payload: {
        itemId: item.itemId,
        linkedRelease: item.linkedRelease,
        requireReleaseEvidence: true,
      },
    },
    {
      ...common,
      label: 'Review pending improvement',
      title: 'Review improvement backlog evidence',
      kind: 'BACKLOG_UPDATE',
      changes: [{ label: 'Review state', before: item.state, after: 'APPROVAL_PENDING' }],
      payload: {
        itemId: item.itemId,
        requestedState: 'APPROVED',
        metricEvidence: item.metricEvidence,
        linkedRelease: item.linkedRelease,
      },
    },
  ];
}

function percentage(value: number | null | undefined) {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}
