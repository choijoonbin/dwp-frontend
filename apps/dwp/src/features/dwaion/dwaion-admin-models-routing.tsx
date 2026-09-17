import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows, OctagonX, Play, RotateCcw, Route, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  FormField,
  OperationalKpiStrip,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
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
  DwaionHealthChip,
} from './admin-advancement/dwaion-admin-advancement-ui';
import {
  DwaionGovernedCommandDialog,
  type DwaionCommandIntent,
} from './admin-advancement/dwaion-governed-command-dialog';
import {
  DwaionEmergencyOperationDialog,
  type DwaionEmergencyOperationDraft,
} from './admin-advancement/dwaion-emergency-operation-dialog';

type PolicyDraft = {
  primaryModelId: string;
  fallbackModelId: string;
  budgetMode: 'WARN' | 'THROTTLE' | 'BLOCK';
  dailyBudget: string;
  modalities: string;
  agentScopes: string;
  inFlightPolicy: 'DRAIN' | 'MIGRATE' | 'CANCEL';
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
  const [simulationInput, setSimulationInput] = useState('');
  const [intent, setIntent] = useState<DwaionCommandIntent | null>(null);
  const [emergencyDraft, setEmergencyDraft] = useState<DwaionEmergencyOperationDraft | null>(null);
  const data = query.data;
  const commandsAvailable = data?.capability.status === 'AVAILABLE' && data.capability.configured;
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
      payload: emergencyDraft,
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
                ariaLabel="AI control plane summary"
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
                        : `${data.monthlySpend.toLocaleString()} / ${data.monthlyBudget.toLocaleString()}`,
                    tone:
                      data.monthlySpend != null &&
                      data.monthlyBudget != null &&
                      data.monthlySpend > data.monthlyBudget
                        ? 'critical'
                        : 'neutral',
                  },
                ]}
              />

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
                  <DwaionAdminSection title={copy.models.providers}>
                    <Stack divider={<Divider flexItem />}>
                      {data.providers.map((provider) => (
                        <Stack
                          key={provider.providerId}
                          direction={{ xs: 'column', md: 'row' }}
                          alignItems={{ xs: 'flex-start', md: 'center' }}
                          justifyContent="space-between"
                          gap={1.5}
                          sx={{ px: 2, py: 1.5 }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="subtitle2">{provider.name}</Typography>
                              <DwaionHealthChip health={provider.health} />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {provider.kind} · {provider.region ?? 'global'} ·{' '}
                              {provider.activeModelCount} models
                            </Typography>
                          </Box>
                          <Stack direction="row" gap={2}>
                            <Metric
                              label="P95"
                              value={
                                provider.latencyP95Ms == null ? '—' : `${provider.latencyP95Ms}ms`
                              }
                            />
                            <Metric
                              label="Success"
                              value={
                                provider.successRate == null
                                  ? '—'
                                  : `${provider.successRate.toFixed(2)}%`
                              }
                            />
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  </DwaionAdminSection>

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
                          label="Primary model"
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
                          label="Fallback model"
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
                          label="Budget action"
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
                          label="Daily budget"
                          value={activeDraft.dailyBudget}
                          onChange={(event) =>
                            setDraft({ ...activeDraft, dailyBudget: event.target.value })
                          }
                        />
                        <FormField
                          label="Modalities"
                          supportingText="Comma-separated verified modalities"
                          value={activeDraft.modalities}
                          onChange={(event) =>
                            setDraft({ ...activeDraft, modalities: event.target.value })
                          }
                        />
                        <FormField
                          label="Agent scope"
                          supportingText="Comma-separated Agent IDs or governed selectors"
                          value={activeDraft.agentScopes}
                          onChange={(event) =>
                            setDraft({ ...activeDraft, agentScopes: event.target.value })
                          }
                        />
                        <SelectField
                          label="In-flight jobs"
                          value={activeDraft.inFlightPolicy}
                          options={(['DRAIN', 'MIGRATE', 'CANCEL'] as const).map((value) => ({
                            value,
                            label: value,
                          }))}
                          onValueChange={(value) =>
                            value && setDraft({ ...activeDraft, inFlightPolicy: value })
                          }
                        />
                        <ActionButton
                          disabled={!commandsAvailable || !policyValid}
                          intent="primary"
                          startIcon={<Route size={16} />}
                          onClick={() => openPolicyCommand('MODEL_ROUTING_UPDATE')}
                        >
                          {copy.models.updatePolicy}
                        </ActionButton>
                        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                          <ActionButton
                            disabled={!commandsAvailable || !policyValid}
                            intent="secondary"
                            startIcon={<Play size={16} />}
                            onClick={() => openPolicyCommand('MODEL_CANARY_START')}
                          >
                            {copy.models.startCanary}
                          </ActionButton>
                          <ActionButton
                            disabled={!commandsAvailable}
                            intent="danger"
                            startIcon={<RotateCcw size={16} />}
                            onClick={() => openPolicyCommand('MODEL_ROLLBACK')}
                          >
                            {copy.models.rollback}
                          </ActionButton>
                        </Stack>
                      </Stack>
                    </DwaionAdminSection>
                  )}

                  <DwaionAdminSection title={copy.models.simulator}>
                    <Stack spacing={1.5} sx={{ p: 2 }}>
                      <FormField
                        multiline
                        minRows={3}
                        label="Workload and constraints"
                        value={simulationInput}
                        onChange={(event) => setSimulationInput(event.target.value)}
                      />
                      <ActionButton
                        intent="secondary"
                        startIcon={<GitCompareArrows size={16} />}
                        disabled={!commandsAvailable || simulationInput.trim().length < 5}
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
                            payload: { workload: simulationInput.trim() },
                          })
                        }
                      >
                        {copy.models.simulator}
                      </ActionButton>
                    </Stack>
                  </DwaionAdminSection>

                  <DwaionAdminSection title="Emergency control">
                    <Stack spacing={1.25} sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {data.emergencyStopActive
                          ? 'Traffic is stopped. Validate fallback health before recovery.'
                          : 'Stops selected AI traffic and moves supported workloads to the verified fallback.'}
                      </Typography>
                      <ActionButton
                        intent={data.emergencyStopActive ? 'primary' : 'danger'}
                        disabled={!commandsAvailable}
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
                      </ActionButton>
                    </Stack>
                  </DwaionAdminSection>
                </Stack>
              </Box>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ textAlign: 'right' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}
