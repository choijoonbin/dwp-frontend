import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  GitCompareArrows,
  OctagonX,
  Play,
  Power,
  RotateCcw,
  Route,
  Save,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import {
  FormField,
  OperationalKpiStrip,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getDwaionModelsRouting,
  type DwaionRoutingPolicySummary,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import { useDwaionAdminAdvancementCopy } from './admin-advancement/dwaion-admin-advancement-copy';
import {
  DwaionAdminQueryBoundary,
  DwaionAdminSection,
  DwaionCapabilityNotice,
  DwaionFreshness,
} from './admin-advancement/dwaion-admin-advancement-ui';
import { DwaionCanonicalCommandActions } from './admin-advancement/dwaion-canonical-command-actions';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './admin-advancement/dwaion-governed-command-dialog';
import {
  DwaionEmergencyOperationDialog,
  type DwaionEmergencyOperationDraft,
} from './admin-advancement/dwaion-emergency-operation-dialog';
import { DwaionPendingApprovalPanel } from './admin-advancement/dwaion-pending-approval-panel';
import { DwaionModelRoutingRegistry } from './admin-advancement/dwaion-model-routing-registry';
import { DwaionCommandCapabilityButton } from './admin-advancement/dwaion-command-capability-button';

type PolicyDraft = {
  primaryModelId: string;
  fallbackModelId: string;
  budgetMode: 'WARN' | 'THROTTLE' | 'BLOCK';
  dailyBudget: string;
  modalities: string;
  agentScopes: string;
  inFlightPolicy: 'DRAIN' | 'MIGRATE' | 'CANCEL';
};

type SimulationDraft = {
  requesterRole: string;
  agentId: string;
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  estimatedTokens: string;
  modality: 'TEXT' | 'IMAGE' | 'AUDIO';
  constraints: string;
};

const INITIAL_SIMULATION: SimulationDraft = {
  requesterRole: 'knowledge-worker',
  agentId: 'dwaion-assistant',
  dataClassification: 'INTERNAL',
  estimatedTokens: '2400',
  modality: 'TEXT',
  constraints: 'p95 <= 1800ms, retain in tenant region, cost optimized',
};

export function DwaionAdminModelsRouting() {
  const copy = useDwaionAdminAdvancementCopy();
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'control-plane', 'models-routing'],
    queryFn: getDwaionModelsRouting,
    staleTime: 20_000,
  });
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [simulation, setSimulation] = useState<SimulationDraft>(INITIAL_SIMULATION);
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  const [emergencyDraft, setEmergencyDraft] = useState<DwaionEmergencyOperationDraft | null>(null);
  const data = query.data;
  const selectedPolicy = useMemo(
    () =>
      data?.routingPolicies.find((policy) => policy.policyId === selectedPolicyId) ??
      data?.routingPolicies[0],
    [data?.routingPolicies, selectedPolicyId]
  );
  const activeDraft = selectedPolicy ? (draft ?? policyDraft(selectedPolicy, data?.models)) : null;
  const policyValid = Boolean(activeDraft && validPolicyDraft(activeDraft));

  const openPolicyCommand = (
    kind: 'MODEL_ROUTING_UPDATE' | 'MODEL_CANARY_START' | 'MODEL_ROLLBACK'
  ) => {
    if (!selectedPolicy || !activeDraft) return;
    setIntent({
      title:
        kind === 'MODEL_ROUTING_UPDATE'
          ? copy.models.updatePolicy
          : kind === 'MODEL_CANARY_START'
            ? copy.models.startCanary
            : copy.models.rollback,
      description: copy.command.description,
      kind,
      target: { type: 'ROUTING_POLICY', id: selectedPolicy.policyId },
      expectedVersion: selectedPolicy.version,
      changes: [
        {
          label: 'Primary model',
          before: selectedPolicy.primaryModelId,
          after: activeDraft.primaryModelId,
        },
        {
          label: 'Fallback',
          before: selectedPolicy.fallbackModelIds.join(', ') || '—',
          after: activeDraft.fallbackModelId || '—',
        },
        {
          label: 'Budget guard',
          before: `${selectedPolicy.budgetMode} · ${selectedPolicy.dailyBudget ?? '—'}`,
          after: `${activeDraft.budgetMode} · ${activeDraft.dailyBudget || '—'}`,
        },
        {
          label: 'Modalities',
          before: 'Current policy',
          after: activeDraft.modalities || 'All verified modalities',
        },
        {
          label: 'Agent scope',
          before: selectedPolicy.scope,
          after: activeDraft.agentScopes || selectedPolicy.scope,
        },
        { label: 'In-flight jobs', before: 'Current handling', after: activeDraft.inFlightPolicy },
      ],
      impacts: [selectedPolicy.scope, 'Active and queued AI workloads', 'Budget enforcement'],
      recoveryPlan:
        'Restore the previous policy version, drain canary traffic, and validate provider health.',
      payload: {
        primaryModelId: activeDraft.primaryModelId,
        fallbackModelIds: activeDraft.fallbackModelId ? [activeDraft.fallbackModelId] : [],
        budgetMode: activeDraft.budgetMode,
        dailyBudget: activeDraft.dailyBudget ? Number(activeDraft.dailyBudget) : null,
        modalities: splitScopes(activeDraft.modalities),
        agentScopes: splitScopes(activeDraft.agentScopes),
        inFlightPolicy: activeDraft.inFlightPolicy,
        trafficPercent: 5,
      },
      destructive: kind === 'MODEL_ROLLBACK',
    });
  };

  const submitEmergencyCommand = () => {
    if (!data || !emergencyDraft) return;
    const recovering = emergencyDraft.mode === 'RECOVER';
    setIntent({
      title: recovering ? copy.models.recovery : copy.models.emergency,
      description: copy.command.description,
      kind: recovering ? 'EMERGENCY_RECOVERY' : 'EMERGENCY_STOP',
      target: { type: 'ROUTING_SCOPE', id: 'tenant' },
      expectedVersion: Math.max(...data.routingPolicies.map((policy) => policy.version), 0),
      changes: recovering
        ? [
            { label: 'Traffic state', before: 'STOPPED', after: 'CANARY_RECOVERY_PENDING' },
            {
              label: 'Canary traffic',
              before: '0%',
              after: `${emergencyDraft.canaryPercent}% for ${emergencyDraft.canaryMinutes} minutes`,
            },
          ]
        : [
            { label: 'Traffic state', before: 'ACTIVE', after: 'STOP_PENDING' },
            {
              label: 'Affected scope',
              before: 'Active',
              after: emergencyDraft.affectedScope,
            },
            {
              label: 'In-flight jobs',
              before: 'Running',
              after: emergencyDraft.inFlightPolicy,
            },
          ],
      impacts: recovering
        ? [
            emergencyDraft.validationEvidence,
            emergencyDraft.failureThreshold,
            emergencyDraft.reStopCriteria,
          ]
        : [
            emergencyDraft.affectedScope,
            emergencyDraft.providerModelScope,
            `Fallback ${emergencyDraft.fallbackRoute}`,
          ],
      recoveryPlan: recovering
        ? 'Automatically stop canary traffic and restore isolation when any validation threshold fails.'
        : 'Validate provider probes, restore the last verified route, and resume through a bounded canary approval.',
      payload: {
        ...emergencyDraft,
        requireIndependentSecondFactor: recovering,
      },
      destructive: !recovering,
    });
    setEmergencyDraft(null);
  };

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={copy.models.eyebrow}
        title={copy.models.title}
        description={copy.models.description}
        actions={
          data ? (
            <DwaionFreshness
              generatedAt={data.generatedAt}
              fetching={query.isFetching}
              onRefresh={() => void query.refetch()}
            />
          ) : undefined
        }
      />

      <Box sx={{ mt: 2.5 }}>
        <DwaionAdminQueryBoundary
          loading={query.isLoading}
          error={query.isError}
          fetching={query.isFetching}
          onRetry={() => void query.refetch()}
        >
          {data && (
            <Stack spacing={2}>
              <DwaionCapabilityNotice capability={data.capability} />
              <OperationalKpiStrip
                ariaLabel={copy.ui.models.summaryLabel}
                items={[
                  {
                    key: 'providers',
                    label: 'Providers',
                    value: data.providers.length,
                    detail: `${data.models.length} models`,
                    tone: data.providers.some((item) => item.health !== 'HEALTHY')
                      ? 'warning'
                      : 'success',
                  },
                  {
                    key: 'approvals',
                    label: copy.models.approvals,
                    value: data.pendingApprovalCount,
                    tone: data.pendingApprovalCount ? 'warning' : 'neutral',
                  },
                  {
                    key: 'canary',
                    label: copy.models.canaries,
                    value: data.activeCanaryCount,
                    tone: 'info',
                  },
                  {
                    key: 'budget',
                    label: 'Monthly budget',
                    value:
                      data.monthlyBudget == null
                        ? '—'
                        : `${Math.round(((data.monthlySpend ?? 0) / data.monthlyBudget) * 100)}%`,
                    detail:
                      data.monthlySpend == null || data.monthlyBudget == null
                        ? 'No verified cost data'
                        : `${formatNumber(data.monthlySpend)} / ${formatNumber(data.monthlyBudget)}`,
                    tone:
                      data.monthlySpend != null &&
                      data.monthlyBudget != null &&
                      data.monthlySpend > data.monthlyBudget
                        ? 'critical'
                        : 'neutral',
                  },
                ]}
              />

              <DwaionPendingApprovalPanel onChanged={() => void query.refetch()} />

              <DwaionModelRoutingRegistry data={data} />

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    xl: 'minmax(0,8fr) minmax(19rem,4fr)',
                  },
                  gap: 2,
                  alignItems: 'start',
                }}
              >
                <Stack spacing={2} sx={{ minWidth: 0 }}>
                  <DwaionAdminSection title={copy.models.policies}>
                    <Stack divider={<Divider flexItem />}>
                      {data.routingPolicies.map((policy) => {
                        const selected = policy.policyId === selectedPolicy?.policyId;
                        return (
                          <ButtonBase
                            key={policy.policyId}
                            onClick={() => {
                              setSelectedPolicyId(policy.policyId);
                              setDraft(null);
                            }}
                            aria-pressed={selected}
                            sx={{
                              textAlign: 'left',
                              width: 1,
                              px: 2,
                              py: 1.5,
                              bgcolor: selected ? 'action.selected' : undefined,
                            }}
                          >
                            <Box sx={{ width: 1, minWidth: 0 }}>
                              <Stack direction="row" justifyContent="space-between" gap={1}>
                                <Typography variant="subtitle2">{policy.name}</Typography>
                                <Chip size="small" label={`${policy.state} · v${policy.version}`} />
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {policy.scope} · {policy.primaryModelId} →{' '}
                                {policy.fallbackModelIds.join(' → ') || 'no fallback'}
                              </Typography>
                            </Box>
                          </ButtonBase>
                        );
                      })}
                    </Stack>
                  </DwaionAdminSection>
                </Stack>

                <Stack
                  spacing={2}
                  sx={{ minWidth: 0, position: { xl: 'sticky' }, top: { xl: 16 } }}
                >
                  {selectedPolicy && activeDraft && (
                    <DwaionAdminSection
                      title={selectedPolicy.name}
                      description={`${selectedPolicy.scope} · v${selectedPolicy.version}`}
                    >
                      <Stack spacing={1.75} sx={{ p: 2 }}>
                        <SelectField
                          label={copy.ui.models.primaryModel}
                          value={activeDraft.primaryModelId}
                          options={data.models.map((model) => ({
                            value: model.modelId,
                            label: model.displayName,
                          }))}
                          onValueChange={(value) =>
                            value && setDraft({ ...activeDraft, primaryModelId: value })
                          }
                        />
                        <SelectField
                          label={copy.ui.models.fallbackModel}
                          value={activeDraft.fallbackModelId}
                          options={[
                            { value: '', label: 'None' },
                            ...data.models.map((model) => ({
                              value: model.modelId,
                              label: model.displayName,
                            })),
                          ]}
                          onValueChange={(value) =>
                            setDraft({ ...activeDraft, fallbackModelId: value ?? '' })
                          }
                        />
                        <SelectField
                          label={copy.ui.models.budgetAction}
                          value={activeDraft.budgetMode}
                          options={(['WARN', 'THROTTLE', 'BLOCK'] as const).map((value) => ({
                            value,
                            label: value,
                          }))}
                          onValueChange={(value) =>
                            value && setDraft({ ...activeDraft, budgetMode: value })
                          }
                        />
                        <FormField
                          type="number"
                          label={copy.ui.models.dailyBudget}
                          value={activeDraft.dailyBudget}
                          onChange={(event) =>
                            setDraft({ ...activeDraft, dailyBudget: event.target.value })
                          }
                        />
                        <FormField
                          label={copy.ui.models.modalities}
                          supportingText="Comma-separated verified modalities"
                          value={activeDraft.modalities}
                          onChange={(event) =>
                            setDraft({ ...activeDraft, modalities: event.target.value })
                          }
                        />
                        <FormField
                          label={copy.ui.models.agentScope}
                          supportingText="Comma-separated Agent IDs or governed selectors"
                          value={activeDraft.agentScopes}
                          onChange={(event) =>
                            setDraft({ ...activeDraft, agentScopes: event.target.value })
                          }
                        />
                        <SelectField
                          label={copy.ui.models.inFlightJobs}
                          value={activeDraft.inFlightPolicy}
                          options={(['DRAIN', 'MIGRATE', 'CANCEL'] as const).map((value) => ({
                            value,
                            label: value,
                          }))}
                          onValueChange={(value) =>
                            value && setDraft({ ...activeDraft, inFlightPolicy: value })
                          }
                        />
                        <DwaionCommandCapabilityButton
                          commandKind="MODEL_ROUTING_UPDATE"
                          disabled={!policyValid}
                          intent="primary"
                          startIcon={<Route size={16} />}
                          onClick={() => openPolicyCommand('MODEL_ROUTING_UPDATE')}
                        >
                          {copy.models.updatePolicy}
                        </DwaionCommandCapabilityButton>
                        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                          <DwaionCommandCapabilityButton
                            commandKind="MODEL_CANARY_START"
                            disabled={!policyValid}
                            intent="secondary"
                            startIcon={<Play size={16} />}
                            onClick={() => openPolicyCommand('MODEL_CANARY_START')}
                          >
                            {copy.models.startCanary}
                          </DwaionCommandCapabilityButton>
                          <DwaionCommandCapabilityButton
                            commandKind="MODEL_ROLLBACK"
                            intent="danger"
                            startIcon={<RotateCcw size={16} />}
                            onClick={() => openPolicyCommand('MODEL_ROLLBACK')}
                          >
                            {copy.models.rollback}
                          </DwaionCommandCapabilityButton>
                        </Stack>
                      </Stack>
                    </DwaionAdminSection>
                  )}

                  <DwaionAdminSection title={copy.models.simulator}>
                    <Stack spacing={1.5} sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
                          gap: 1.25,
                        }}
                      >
                        <FormField
                          label={copy.ui.models.requesterRole}
                          value={simulation.requesterRole}
                          onChange={(event) =>
                            setSimulation({ ...simulation, requesterRole: event.target.value })
                          }
                        />
                        <FormField
                          label={copy.ui.models.agentId}
                          value={simulation.agentId}
                          onChange={(event) =>
                            setSimulation({ ...simulation, agentId: event.target.value })
                          }
                        />
                        <SelectField
                          label={copy.ui.models.dataClassification}
                          value={simulation.dataClassification}
                          options={(
                            ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const
                          ).map((value) => ({ value, label: value }))}
                          onValueChange={(value) =>
                            value && setSimulation({ ...simulation, dataClassification: value })
                          }
                        />
                        <SelectField
                          label={copy.ui.models.modality}
                          value={simulation.modality}
                          options={(['TEXT', 'IMAGE', 'AUDIO'] as const).map((value) => ({
                            value,
                            label: value,
                          }))}
                          onValueChange={(value) =>
                            value && setSimulation({ ...simulation, modality: value })
                          }
                        />
                        <FormField
                          type="number"
                          label={copy.ui.models.estimatedTokens}
                          value={simulation.estimatedTokens}
                          onChange={(event) =>
                            setSimulation({ ...simulation, estimatedTokens: event.target.value })
                          }
                        />
                      </Box>
                      <FormField
                        multiline
                        minRows={3}
                        label={copy.ui.models.workloadConstraints}
                        value={simulation.constraints}
                        onChange={(event) =>
                          setSimulation({ ...simulation, constraints: event.target.value })
                        }
                      />
                      <DwaionCommandCapabilityButton
                        commandKind="MODEL_ROUTE_SIMULATE"
                        intent="secondary"
                        startIcon={<GitCompareArrows size={16} />}
                        disabled={
                          !simulation.requesterRole.trim() ||
                          !simulation.agentId.trim() ||
                          !Number.isFinite(Number(simulation.estimatedTokens)) ||
                          Number(simulation.estimatedTokens) <= 0 ||
                          simulation.constraints.trim().length < 5
                        }
                        onClick={() =>
                          setIntent({
                            title: copy.models.simulator,
                            description:
                              'Run a read-only routing decision with pinned policy versions.',
                            kind: 'MODEL_ROUTE_SIMULATE',
                            target: { type: 'ROUTING_SIMULATOR', id: 'tenant' },
                            expectedVersion: 0,
                            changes: [
                              { label: 'Policy', before: 'No change', after: 'Dry-run only' },
                            ],
                            impacts: ['No production traffic or policy is changed'],
                            recoveryPlan:
                              'No recovery is required because the simulation is side-effect free.',
                            payload: {
                              ...simulation,
                              estimatedTokens: Number(simulation.estimatedTokens),
                            },
                          })
                        }
                      >
                        {copy.models.simulator}
                      </DwaionCommandCapabilityButton>
                      {data.latestSimulation && (
                        <Box
                          aria-label={copy.ui.models.latestSimulationResult}
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 2,
                            bgcolor: 'action.hover',
                            p: 1.5,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" gap={1}>
                            <Typography variant="subtitle2">
                              {data.latestSimulation.decision}
                            </Typography>
                            <Chip size="small" label={data.latestSimulation.matchedRuleId} />
                          </Stack>
                          <Typography variant="body2" sx={{ mt: 0.75 }}>
                            {copy.ui.models.targetPrefix}{' '}
                            {data.latestSimulation.targetModelId ?? 'Fail closed'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {data.latestSimulation.estimatedCost == null
                              ? 'Cost —'
                              : `${data.latestSimulation.estimatedCost.toFixed(4)} ${data.latestSimulation.currency}`}{' '}
                            ·{' '}
                            {data.latestSimulation.estimatedLatencyMs == null
                              ? 'Latency —'
                              : data.latestSimulation.estimatedLatencyMs}
                            {copy.ui.models.latencyFallbackSeparator}{' '}
                            {data.latestSimulation.fallbackModelIds.join(' → ') || 'none'}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </DwaionAdminSection>

                  <DwaionAdminSection title={copy.ui.models.emergencyControl}>
                    <Stack spacing={1.25} sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {data.emergencyStopActive
                          ? 'Traffic is stopped. Validate fallback health before recovery.'
                          : 'Stops selected AI traffic and moves supported workloads to the verified fallback.'}
                      </Typography>
                      <DwaionCommandCapabilityButton
                        commandKind={
                          data.emergencyStopActive ? 'EMERGENCY_RECOVERY' : 'EMERGENCY_STOP'
                        }
                        intent={data.emergencyStopActive ? 'primary' : 'danger'}
                        startIcon={
                          data.emergencyStopActive ? (
                            <ShieldCheck size={16} />
                          ) : (
                            <OctagonX size={16} />
                          )
                        }
                        onClick={() =>
                          setEmergencyDraft(
                            data.emergencyStopActive
                              ? {
                                  mode: 'RECOVER',
                                  validationEvidence: '',
                                  canaryPercent: '5',
                                  canaryMinutes: '30',
                                  failureThreshold: '',
                                  reStopCriteria: '',
                                }
                              : {
                                  mode: 'STOP',
                                  affectedScope: 'tenant',
                                  providerModelScope: data.models
                                    .map((model) => model.modelId)
                                    .join(', '),
                                  fallbackRoute: '',
                                  inFlightPolicy: 'MIGRATE',
                                }
                          )
                        }
                      >
                        {data.emergencyStopActive ? copy.models.recovery : copy.models.emergency}
                      </DwaionCommandCapabilityButton>
                    </Stack>
                  </DwaionAdminSection>
                </Stack>
              </Box>

              {selectedPolicy && (
                <DwaionCanonicalCommandActions
                  title={copy.ui.models.controlOperations}
                  description={copy.ui.models.controlOperationsDescription}
                  disabled={false}
                  onRefresh={async () => {
                    await query.refetch();
                  }}
                  actions={[
                    {
                      label: 'Save routing draft',
                      icon: <Save size={16} />,
                      title: 'Save routing policy draft',
                      description: copy.command.description,
                      kind: 'MODEL_ROUTING_DRAFT_SAVE',
                      target: { type: 'ROUTING_POLICY', id: selectedPolicy.policyId },
                      expectedVersion: selectedPolicy.version,
                      changes: [
                        {
                          label: 'Draft',
                          before: `v${selectedPolicy.version}`,
                          after: 'New governed draft',
                        },
                      ],
                      impacts: [selectedPolicy.scope, 'No production traffic until approved'],
                      recoveryPlan:
                        'Discard the draft and retain the currently active policy revision.',
                      payload: { policyId: selectedPolicy.policyId, draft: activeDraft },
                    },
                    {
                      label: 'Open provider circuit',
                      icon: <Power size={16} />,
                      title: 'Open provider circuit',
                      description: copy.command.description,
                      kind: 'PROVIDER_CIRCUIT_BREAK',
                      target: {
                        type: 'PROVIDER',
                        id: data.providers[0]?.providerId ?? 'unconfigured',
                      },
                      expectedVersion: selectedPolicy.version,
                      changes: [{ label: 'Circuit', before: 'CLOSED', after: 'OPEN_PENDING' }],
                      impacts: [
                        selectedPolicy.scope,
                        'In-flight requests migrate to verified fallback',
                      ],
                      recoveryPlan:
                        'Close the circuit after provider probes pass and restore traffic by canary.',
                      payload: {
                        providerId: data.providers[0]?.providerId,
                        inFlightPolicy: 'MIGRATE',
                      },
                      destructive: true,
                    },
                    {
                      label: 'Smart isolate model',
                      icon: <ShieldOff size={16} />,
                      title: 'Smart isolate model',
                      description: copy.command.description,
                      kind: 'MODEL_SMART_ISOLATE',
                      target: { type: 'MODEL', id: selectedPolicy.primaryModelId },
                      expectedVersion: selectedPolicy.version,
                      changes: [
                        { label: 'Serving state', before: 'ACTIVE', after: 'ISOLATED_PENDING' },
                      ],
                      impacts: [selectedPolicy.scope, 'Fallback and queued workload routing'],
                      recoveryPlan:
                        'Restore the model only after probes, policy checks, and canary validation pass.',
                      payload: {
                        modelId: selectedPolicy.primaryModelId,
                        fallbackModelIds: selectedPolicy.fallbackModelIds,
                      },
                      destructive: true,
                    },
                    {
                      label: 'Recovery dry-run',
                      icon: <Play size={16} />,
                      title: 'Simulate emergency recovery',
                      description: copy.command.description,
                      kind: 'EMERGENCY_RECOVERY_SIMULATE',
                      target: { type: 'ROUTING_SCOPE', id: selectedPolicy.scope },
                      expectedVersion: selectedPolicy.version,
                      changes: [
                        { label: 'Traffic', before: 'Current state', after: 'Dry-run only' },
                      ],
                      impacts: ['No production traffic changes', selectedPolicy.scope],
                      recoveryPlan: 'No recovery is required for a side-effect-free simulation.',
                      payload: { policyId: selectedPolicy.policyId, canaryPercent: 5 },
                    },
                    {
                      label: 'Rollback isolation',
                      icon: <RotateCcw size={16} />,
                      title: 'Rollback emergency isolation',
                      description: copy.command.description,
                      kind: 'EMERGENCY_ISOLATION_ROLLBACK',
                      target: { type: 'ROUTING_SCOPE', id: selectedPolicy.scope },
                      expectedVersion: selectedPolicy.version,
                      changes: [
                        { label: 'Isolation', before: 'ACTIVE', after: 'ROLLBACK_PENDING' },
                      ],
                      impacts: [
                        selectedPolicy.scope,
                        'Previously isolated provider and model routes',
                      ],
                      recoveryPlan:
                        'Re-apply isolation automatically if any canary threshold fails.',
                      payload: { policyId: selectedPolicy.policyId, validationRequired: true },
                      destructive: true,
                    },
                    {
                      label: 'Export incident JSONL',
                      icon: <Download size={16} />,
                      title: 'Export control-plane incident evidence',
                      description: copy.command.description,
                      kind: 'INCIDENT_REPORT_EXPORT',
                      target: { type: 'ROUTING_SCOPE', id: selectedPolicy.scope },
                      expectedVersion: selectedPolicy.version,
                      changes: [
                        {
                          label: 'Evidence export',
                          before: 'Not generated',
                          after: 'JSONL_PENDING',
                        },
                      ],
                      impacts: ['Immutable command and worker receipt evidence only'],
                      recoveryPlan:
                        'Revoke the generated download receipt if export validation fails.',
                      payload: { format: 'JSONL', policyId: selectedPolicy.policyId },
                    },
                  ]}
                />
              )}
            </Stack>
          )}
        </DwaionAdminQueryBoundary>
      </Box>
      <DwaionGovernedCommandDialog
        intent={intent}
        onClose={() => setIntent(null)}
        onReconcile={async () => {
          setDraft(null);
          await query.refetch();
        }}
        onCompleted={async () => {
          setIntent(null);
          setDraft(null);
          await query.refetch();
        }}
      />
      <DwaionEmergencyOperationDialog
        value={emergencyDraft}
        onChange={setEmergencyDraft}
        onClose={() => setEmergencyDraft(null)}
        onSubmit={submitEmergencyCommand}
      />
    </PageCanvas>
  );
}

function policyDraft(
  policy: DwaionRoutingPolicySummary,
  models: Array<{ modelId: string; modalities: string[] }> | undefined
): PolicyDraft {
  const model = models?.find((item) => item.modelId === policy.primaryModelId);
  return {
    primaryModelId: policy.primaryModelId,
    fallbackModelId: policy.fallbackModelIds[0] ?? '',
    budgetMode: policy.budgetMode,
    dailyBudget: policy.dailyBudget == null ? '' : String(policy.dailyBudget),
    modalities: model?.modalities.join(', ') ?? '',
    agentScopes: '',
    inFlightPolicy: 'DRAIN',
  };
}

function splitScopes(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validPolicyDraft(draft: PolicyDraft) {
  if (!draft.primaryModelId || draft.primaryModelId === draft.fallbackModelId) return false;
  if (!draft.dailyBudget) return true;
  const budget = Number(draft.dailyBudget);
  return Number.isFinite(budget) && budget > 0;
}
