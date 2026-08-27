import type { ReactNode } from 'react';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Check,
  CirclePause,
  CirclePlay,
  Flag,
  Gauge,
  GitPullRequestArrow,
  LockKeyhole,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  StepForward,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateProviderFeatureRollout,
  advanceProviderFeatureRollout,
  createProviderFeatureFlag,
  createProviderFeatureRollout,
  decideProviderFeatureRollout,
  evaluateProviderFeatureFlag,
  getProviderOperatorProfile,
  listProviderFeatureFlags,
  listProviderFeatureRollouts,
  listProviderTenants,
  pauseProviderFeatureRollout,
  resumeProviderFeatureRollout,
  rollbackProviderFeatureRollout,
  submitProviderFeatureRollout,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  OperationalContextBar,
  SelectField,
  SignalMetric,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ProviderFeatureFlag,
  ProviderFeatureRollout,
  ProviderFeatureValue,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

type RolloutAction =
  'submit' | 'approve' | 'reject' | 'activate' | 'pause' | 'resume' | 'advance' | 'rollback';

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} JSON is invalid.`);
  }
}

function displayValue(value: ProviderFeatureValue): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function FlagDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (request: Parameters<typeof createProviderFeatureFlag>[0]) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [featureKey, setFeatureKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerService, setOwnerService] = useState('dwp-platform-server');
  const [valueType, setValueType] = useState<ProviderFeatureFlag['valueType']>('BOOLEAN');
  const [defaultValue, setDefaultValue] = useState('false');
  const [schema, setSchema] = useState('{}');
  const [riskTier, setRiskTier] = useState<ProviderFeatureFlag['riskTier']>('L2');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      const parsedDefault = parseJson(defaultValue, t('featureRollouts.fields.defaultValue'));
      const parsedSchema = parseJson(schema, t('featureRollouts.fields.schema'));
      if (!parsedSchema || Array.isArray(parsedSchema) || typeof parsedSchema !== 'object') {
        throw new Error(t('featureRollouts.validation.schemaObject'));
      }
      await onSave({
        featureKey: featureKey.trim(),
        displayName: displayName.trim(),
        description: description.trim(),
        ownerService: ownerService.trim(),
        valueType,
        defaultValue: parsedDefault as ProviderFeatureValue,
        configurationSchema: parsedSchema as Record<string, unknown>,
        riskTier,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.operation'));
    }
  };

  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('featureRollouts.createFlag.title')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('featureRollouts.createFlag.action')}
      busy={busy}
      submitDisabled={
        !featureKey.trim() || !displayName.trim() || !description.trim() || !ownerService.trim()
      }
      onClose={onClose}
      onSubmit={save}
    >
      <Stack gap={2}>
        <Alert severity="info">{t('featureRollouts.createFlag.guidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('featureRollouts.fields.featureKey')}
            value={featureKey}
            onChange={(event) => setFeatureKey(event.target.value)}
            supportingText={t('featureRollouts.createFlag.keyHint')}
          />
          <FormField
            required
            label={t('featureRollouts.fields.displayName')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Stack>
        <FormField
          required
          multiline
          minRows={2}
          label={t('featureRollouts.fields.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('featureRollouts.fields.ownerService')}
            value={ownerService}
            onChange={(event) => setOwnerService(event.target.value)}
          />
          <SelectField
            label={t('featureRollouts.fields.valueType')}
            value={valueType}
            options={(['BOOLEAN', 'STRING', 'NUMBER', 'JSON'] as const).map((type) => ({
              value: type,
              label: type,
            }))}
            onValueChange={(next) => setValueType(next as ProviderFeatureFlag['valueType'])}
          />
          <SelectField
            label={t('featureRollouts.fields.riskTier')}
            value={riskTier}
            options={(['L1', 'L2', 'L3'] as const).map((tier) => ({
              value: tier,
              label: tier,
            }))}
            onValueChange={(next) => setRiskTier(next as ProviderFeatureFlag['riskTier'])}
          />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormField
            required
            multiline
            minRows={4}
            label={t('featureRollouts.fields.defaultValue')}
            value={defaultValue}
            onChange={(event) => setDefaultValue(event.target.value)}
            supportingText={t('featureRollouts.createFlag.secretHint')}
          />
          <FormField
            required
            multiline
            minRows={4}
            label={t('featureRollouts.fields.schema')}
            value={schema}
            onChange={(event) => setSchema(event.target.value)}
          />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

function RolloutDialog({
  flags,
  busy,
  onClose,
  onSave,
}: {
  flags: ProviderFeatureFlag[];
  busy: boolean;
  onClose: () => void;
  onSave: (
    featureKey: string,
    request: Parameters<typeof createProviderFeatureRollout>[1]
  ) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [featureKey, setFeatureKey] = useState(flags[0]?.featureKey ?? '');
  const selectedFlag = flags.find((flag) => flag.featureKey === featureKey);
  const [name, setName] = useState('');
  const [value, setValue] = useState(
    selectedFlag ? displayValue(selectedFlag.defaultValue) : 'false'
  );
  const [targeting, setTargeting] = useState('{}');
  const [strategy, setStrategy] = useState<ProviderFeatureRollout['strategy']>('RING');
  const [percentages, setPercentages] = useState('5,25,100');
  const [observationMinutes, setObservationMinutes] = useState('30');
  const [healthGate, setHealthGate] = useState(
    '{\n  "maxErrorRate": 1,\n  "maxP95LatencyMs": 800\n}'
  );
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changeFeature = (next: string) => {
    setFeatureKey(next);
    const flag = flags.find((item) => item.featureKey === next);
    if (flag) setValue(displayValue(flag.defaultValue));
  };

  const save = async () => {
    try {
      const parsedValue = parseJson(value, t('featureRollouts.fields.rolloutValue'));
      const parsedTargeting = parseJson(targeting, t('featureRollouts.fields.targeting'));
      const parsedHealth = parseJson(healthGate, t('featureRollouts.fields.healthGate'));
      if (
        !parsedTargeting ||
        Array.isArray(parsedTargeting) ||
        typeof parsedTargeting !== 'object' ||
        !parsedHealth ||
        Array.isArray(parsedHealth) ||
        typeof parsedHealth !== 'object'
      ) {
        throw new Error(t('featureRollouts.validation.objectJson'));
      }
      const values = percentages
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((part) => Number.isFinite(part));
      if (!values.length || values.some((part) => part <= 0 || part > 100)) {
        throw new Error(t('featureRollouts.validation.percentages'));
      }
      await onSave(featureKey, {
        name: name.trim(),
        rolloutValue: parsedValue as ProviderFeatureValue,
        targeting: parsedTargeting as Record<string, unknown>,
        strategy,
        justification: justification.trim(),
        stages: values.map((percentage, index) => ({
          stageName: t('featureRollouts.stageName', { index: index + 1, percentage }),
          exposurePercentage: percentage,
          minimumObservationMinutes: Number(observationMinutes),
          healthGate: parsedHealth as Record<string, unknown>,
        })),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.operation'));
    }
  };

  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('featureRollouts.createRollout.title')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('featureRollouts.createRollout.action')}
      busy={busy}
      submitDisabled={!featureKey || !name.trim() || !justification.trim()}
      onClose={onClose}
      onSubmit={save}
    >
      <Stack gap={2}>
        <Alert severity="warning">{t('featureRollouts.createRollout.guidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <SelectField
            required
            label={t('featureRollouts.fields.feature')}
            value={featureKey}
            options={flags.map((flag) => ({
              value: flag.featureKey,
              label: `${flag.displayName} · ${flag.featureKey}`,
            }))}
            onValueChange={changeFeature}
          />
          <FormField
            required
            label={t('featureRollouts.fields.rolloutName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <SelectField
            label={t('featureRollouts.fields.strategy')}
            value={strategy}
            options={(['RING', 'PERCENTAGE', 'ALL_AT_ONCE'] as const).map((item) => ({
              value: item,
              label: t(`featureRollouts.strategies.${item}`),
            }))}
            onValueChange={(next) => setStrategy(next as ProviderFeatureRollout['strategy'])}
          />
          <FormField
            required
            label={t('featureRollouts.fields.stagePercentages')}
            value={percentages}
            onChange={(event) => setPercentages(event.target.value)}
            supportingText={t('featureRollouts.createRollout.stageHint')}
          />
          <FormField
            required
            type="number"
            label={t('featureRollouts.fields.observationMinutes')}
            value={observationMinutes}
            onChange={(event) => setObservationMinutes(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 5 } }}
          />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormField
            required
            multiline
            minRows={5}
            label={t('featureRollouts.fields.rolloutValue')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <FormField
            required
            multiline
            minRows={5}
            label={t('featureRollouts.fields.targeting')}
            value={targeting}
            onChange={(event) => setTargeting(event.target.value)}
            supportingText={t('featureRollouts.createRollout.targetHint')}
          />
          <FormField
            required
            multiline
            minRows={5}
            label={t('featureRollouts.fields.healthGate')}
            value={healthGate}
            onChange={(event) => setHealthGate(event.target.value)}
          />
        </Stack>
        <FormField
          required
          multiline
          minRows={2}
          label={t('featureRollouts.fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function ActionDialog({
  rollout,
  action,
  busy,
  onClose,
  onSubmit,
}: {
  rollout: ProviderFeatureRollout;
  action: RolloutAction;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, health: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const [health, setHealth] = useState(
    '{\n  "maxErrorRate": 0,\n  "maxP95LatencyMs": 0,\n  "minSuccessRate": 100\n}'
  );
  const [error, setError] = useState<string | null>(null);
  const dangerous = ['reject', 'rollback'].includes(action);
  const save = async () => {
    try {
      const parsed = action === 'advance' ? parseJson(health, 'Health evidence') : {};
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error(t('featureRollouts.validation.objectJson'));
      }
      await onSubmit(reason.trim(), parsed as Record<string, unknown>);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.operation'));
    }
  };
  return (
    <FormDialog
      open
      title={t(`featureRollouts.actionDialog.${action}.title`)}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(`featureRollouts.actions.${action}`)}
      submitIntent={dangerous ? 'danger' : 'primary'}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
      onSubmit={save}
    >
      <Stack gap={2}>
        <Box>
          <Typography variant="subtitle2" fontWeight={750}>
            {rollout.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('featureRollouts.revisionIdentity', {
              key: rollout.featureKey,
              revision: rollout.revisionNumber,
            })}
          </Typography>
        </Box>
        <Alert severity={dangerous ? 'warning' : 'info'}>
          {t(`featureRollouts.actionDialog.${action}.description`)}
        </Alert>
        {error && <Alert severity="error">{error}</Alert>}
        {action === 'advance' && (
          <FormField
            required
            multiline
            minRows={5}
            label={t('featureRollouts.fields.observedHealth')}
            value={health}
            onChange={(event) => setHealth(event.target.value)}
          />
        )}
        <FormField
          required
          multiline
          minRows={3}
          label={t('featureRollouts.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function RolloutInspector({
  rollout,
  canWrite,
  canApprove,
  onAction,
}: {
  rollout: ProviderFeatureRollout;
  canWrite: boolean;
  canApprove: boolean;
  onAction: (action: RolloutAction) => void;
}) {
  const { t } = useTranslation('provider');
  const activeStage = rollout.stages.find(
    (stage) => stage.stageOrder === rollout.currentStageOrder
  );
  const actions: Array<{ action: RolloutAction; icon: ReactNode }> = [];
  if (canWrite && rollout.lifecycleState === 'DRAFT') {
    actions.push({ action: 'submit', icon: <Send size={16} /> });
  }
  if (canApprove && rollout.lifecycleState === 'PENDING_APPROVAL') {
    actions.push({ action: 'approve', icon: <Check size={16} /> });
    actions.push({ action: 'reject', icon: <X size={16} /> });
  }
  if (canWrite && rollout.lifecycleState === 'APPROVED') {
    actions.push({ action: 'activate', icon: <CirclePlay size={16} /> });
  }
  if (canWrite && rollout.lifecycleState === 'ACTIVE') {
    actions.push({ action: 'pause', icon: <CirclePause size={16} /> });
    actions.push({ action: 'advance', icon: <StepForward size={16} /> });
  }
  if (canWrite && rollout.lifecycleState === 'PAUSED') {
    actions.push({ action: 'resume', icon: <CirclePlay size={16} /> });
  }
  if (
    canWrite &&
    canApprove &&
    ['ACTIVE', 'PAUSED', 'COMPLETED'].includes(rollout.lifecycleState)
  ) {
    actions.push({ action: 'rollback', icon: <RotateCcw size={16} /> });
  }

  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <ProviderSectionHeading
        title={rollout.name}
        description={`${rollout.featureKey} · ${t('featureRollouts.revision', {
          revision: rollout.revisionNumber,
        })}`}
        action={<ProviderStatusChip state={rollout.lifecycleState} />}
      />
      <Stack gap={2} sx={{ mt: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            size="small"
            variant="outlined"
            label={t(`featureRollouts.strategies.${rollout.strategy}`)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t('featureRollouts.requester', { id: rollout.requestedBy })}
          />
          {rollout.approvedBy && (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={t('featureRollouts.approver', { id: rollout.approvedBy })}
            />
          )}
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            icon={<LockKeyhole size={14} />}
            label={t('featureRollouts.externalLocked')}
          />
        </Stack>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('featureRollouts.fields.targeting')}
          </Typography>
          <Typography
            component="pre"
            variant="body2"
            sx={{ m: 0, mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {JSON.stringify(rollout.targeting, null, 2)}
          </Typography>
        </Box>
        <Divider />
        <Box>
          <Typography variant="subtitle2">{t('featureRollouts.stagePlan')}</Typography>
          <Stack gap={1.25} sx={{ mt: 1 }}>
            {rollout.stages.map((stage) => (
              <Box key={stage.rolloutStageId}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" fontWeight={700}>
                    {stage.stageOrder}. {stage.stageName}
                  </Typography>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {t('featureRollouts.observation', {
                        minutes: stage.minimumObservationMinutes,
                      })}
                    </Typography>
                    <ProviderStatusChip state={stage.lifecycleState} />
                  </Stack>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={stage.exposurePercentage}
                  aria-label={t('featureRollouts.stageExposure', {
                    percentage: stage.exposurePercentage,
                  })}
                  sx={{ mt: 0.75, height: 6, borderRadius: 0.5 }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
        {activeStage && (
          <Alert severity="info">
            {t('featureRollouts.activeStage', {
              name: activeStage.stageName,
              percentage: activeStage.exposurePercentage,
            })}
          </Alert>
        )}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {actions.map(({ action, icon }) => (
            <ActionButton
              key={action}
              intent={['reject', 'rollback'].includes(action) ? 'danger' : 'secondary'}
              startIcon={icon}
              onClick={() => onAction(action)}
            >
              {t(`featureRollouts.actions.${action}`)}
            </ActionButton>
          ))}
          {!actions.length && (
            <Typography variant="body2" color="text.secondary">
              {t('featureRollouts.noAvailableActions')}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function EvaluationPreview({
  flags,
  tenants,
}: {
  flags: ProviderFeatureFlag[];
  tenants: ProviderTenant[];
}) {
  const { t } = useTranslation('provider');
  const [featureKey, setFeatureKey] = useState(flags[0]?.featureKey ?? '');
  const [tenantId, setTenantId] = useState(tenants[0]?.tenantId ?? '');
  const evaluation = useMutation({
    mutationFn: () => evaluateProviderFeatureFlag(featureKey, tenantId),
  });
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <ProviderSectionHeading
        title={t('featureRollouts.evaluation.title')}
        description={t('featureRollouts.evaluation.description')}
      />
      <Stack gap={1.5} sx={{ mt: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
          <SelectField
            label={t('featureRollouts.fields.feature')}
            value={featureKey}
            options={flags.map((flag) => ({
              value: flag.featureKey,
              label: flag.displayName,
            }))}
            onValueChange={setFeatureKey}
          />
          <SelectField
            label={t('featureRollouts.fields.tenant')}
            value={tenantId}
            options={tenants.map((tenant) => ({
              value: tenant.tenantId,
              label: `${tenant.displayName} · ${tenant.tenantKey}`,
            }))}
            onValueChange={setTenantId}
          />
          <ActionButton
            intent="secondary"
            startIcon={<Gauge size={16} />}
            loading={evaluation.isPending}
            disabled={!featureKey || !tenantId}
            onClick={() => evaluation.mutate()}
            sx={{ flexShrink: 0 }}
          >
            {t('featureRollouts.evaluation.action')}
          </ActionButton>
        </Stack>
        {evaluation.isError && (
          <Alert severity="error">{providerError(evaluation.error, t('errors.operation'))}</Alert>
        )}
        {evaluation.data && (
          <Alert severity={evaluation.data.reasonCode === 'ROLLOUT_MATCH' ? 'success' : 'info'}>
            <Typography variant="subtitle2">
              {t(`featureRollouts.evaluation.reasons.${evaluation.data.reasonCode}`)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('featureRollouts.evaluation.result', {
                tenant: evaluation.data.tenantKey,
                value: displayValue(evaluation.data.value),
                bucket: evaluation.data.deterministicBucket,
                exposure: evaluation.data.exposurePercentage,
              })}
            </Typography>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

export function ProviderFeatureRollouts() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'flag' | 'rollout' | RolloutAction | null>(null);
  const flags = useQuery({
    queryKey: ['provider', 'feature-flags'],
    queryFn: listProviderFeatureFlags,
  });
  const rollouts = useQuery({
    queryKey: ['provider', 'feature-rollouts'],
    queryFn: () => listProviderFeatureRollouts(),
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const canReadEstate = operator.data?.permissions.includes('ESTATE_READ') ?? false;
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'rollout-evaluation'],
    queryFn: () => listProviderTenants({ page: 0, size: 100 }),
    enabled: canReadEstate,
  });
  const selected = (rollouts.data ?? []).find(
    (rollout) => rollout.rolloutRevisionId === selectedId
  );
  const canWrite = operator.data?.permissions.includes('FEATURE_ROLLOUT_WRITE') ?? false;
  const canApprove = operator.data?.permissions.includes('FEATURE_ROLLOUT_APPROVE') ?? false;
  const pendingCount = (rollouts.data ?? []).filter(
    (rollout) => rollout.lifecycleState === 'PENDING_APPROVAL'
  ).length;
  const activeCount = (rollouts.data ?? []).filter((rollout) =>
    ['ACTIVE', 'PAUSED'].includes(rollout.lifecycleState)
  ).length;
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['provider', 'feature-flags'] }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'feature-rollouts'] }),
      ]);
      setDialog(null);
      toast.success(t('featureRollouts.completed'));
    },
    onError: (error) => toast.error(providerError(error, t('errors.operation'))),
  });

  const columns = useMemo<GridColDef<ProviderFeatureRollout>[]>(
    () => [
      {
        field: 'name',
        headerName: t('featureRollouts.columns.rollout'),
        minWidth: 280,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.75 }}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {t('featureRollouts.revisionIdentity', {
                key: row.featureKey,
                revision: row.revisionNumber,
              })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'strategy',
        headerName: t('featureRollouts.columns.strategy'),
        minWidth: 150,
        valueFormatter: (value) => t(`featureRollouts.strategies.${String(value)}`),
      },
      {
        field: 'currentStageOrder',
        headerName: t('featureRollouts.columns.stage'),
        minWidth: 190,
        valueGetter: (_value, row) => {
          const stage = row.stages.find((item) => item.stageOrder === row.currentStageOrder);
          return stage ? `${stage.stageName} · ${stage.exposurePercentage}%` : t('notAvailable');
        },
      },
      {
        field: 'lifecycleState',
        headerName: t('featureRollouts.columns.state'),
        width: 150,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
      {
        field: 'submittedAt',
        headerName: t('featureRollouts.columns.updated'),
        width: 190,
        valueGetter: (_value, row) =>
          formatProviderDate(row.activatedAt ?? row.approvedAt ?? row.submittedAt),
      },
    ],
    [t]
  );

  if ((flags.isLoading || rollouts.isLoading || operator.isLoading) && !rollouts.data) {
    return <ProviderLoading />;
  }
  const firstError = flags.error ?? rollouts.error ?? operator.error;
  if (firstError && !rollouts.data) {
    return (
      <ProviderError
        error={firstError}
        onRetry={() => {
          void flags.refetch();
          void rollouts.refetch();
          void operator.refetch();
        }}
        retrying={flags.isFetching || rollouts.isFetching || operator.isFetching}
      />
    );
  }

  const runAction = async (
    action: RolloutAction,
    reason: string,
    health: Record<string, unknown>
  ) => {
    if (!selected) return;
    const work = () => {
      switch (action) {
        case 'submit':
          return submitProviderFeatureRollout(selected, reason);
        case 'approve':
          return decideProviderFeatureRollout(selected, 'APPROVED', reason);
        case 'reject':
          return decideProviderFeatureRollout(selected, 'REJECTED', reason);
        case 'activate':
          return activateProviderFeatureRollout(selected, reason);
        case 'pause':
          return pauseProviderFeatureRollout(selected, reason);
        case 'resume':
          return resumeProviderFeatureRollout(selected, reason);
        case 'advance':
          return advanceProviderFeatureRollout(selected, reason, health);
        case 'rollback':
          return rollbackProviderFeatureRollout(selected, reason);
      }
    };
    await mutation.mutateAsync(work);
  };

  return (
    <Stack gap={2.5}>
      <OperationalContextBar
        label={t('featureRollouts.contextLabel')}
        items={[
          {
            label: t('featureRollouts.context.registry'),
            value: t('featureRollouts.context.flagCount', { count: flags.data?.length ?? 0 }),
            icon: <Flag size={16} />,
          },
          {
            label: t('featureRollouts.context.evaluation'),
            value: t('featureRollouts.context.deterministic'),
            icon: <Activity size={16} />,
          },
          {
            label: t('featureRollouts.context.externalExecution'),
            value: t('featureRollouts.context.locked'),
            icon: <LockKeyhole size={16} />,
          },
        ]}
        actions={
          canWrite ? (
            <Stack direction="row" gap={1}>
              <ActionButton
                intent="secondary"
                startIcon={<Plus size={16} />}
                onClick={() => setDialog('flag')}
              >
                {t('featureRollouts.actions.newFlag')}
              </ActionButton>
              <ActionButton
                intent="primary"
                startIcon={<GitPullRequestArrow size={16} />}
                disabled={!flags.data?.length}
                onClick={() => setDialog('rollout')}
              >
                {t('featureRollouts.actions.newRollout')}
              </ActionButton>
            </Stack>
          ) : undefined
        }
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('featureRollouts.metrics.flags')}
          value={String(flags.data?.length ?? 0)}
          detail={t('featureRollouts.metrics.flagsDetail')}
          icon={<Flag size={18} />}
        />
        <SignalMetric
          label={t('featureRollouts.metrics.pending')}
          value={String(pendingCount)}
          detail={t('featureRollouts.metrics.pendingDetail')}
          icon={<ShieldCheck size={18} />}
          tone={pendingCount > 0 ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('featureRollouts.metrics.running')}
          value={String(activeCount)}
          detail={t('featureRollouts.metrics.runningDetail')}
          icon={<Activity size={18} />}
          tone={activeCount > 0 ? 'info' : 'neutral'}
        />
      </Box>
      <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
        <ProviderSectionHeading
          title={t('featureRollouts.inventory.title')}
          description={t('featureRollouts.inventory.description')}
        />
        <Box sx={{ mt: 1.5 }}>
          {(rollouts.data ?? []).length ? (
            <EnterpriseDataGrid
              ariaLabel={t('featureRollouts.gridLabel')}
              rows={rollouts.data ?? []}
              columns={columns}
              getRowId={(row) => row.rolloutRevisionId}
              hideFooter
              rowHeight={58}
              minVisibleRows={3}
              maxVisibleRows={8}
              onRowClick={({ row }) => setSelectedId(row.rolloutRevisionId)}
              getRowClassName={({ row }) =>
                row.rolloutRevisionId === selectedId ? 'Mui-selected' : ''
              }
            />
          ) : (
            <EmptyState
              title={t('featureRollouts.empty.title')}
              description={t('featureRollouts.empty.description')}
              action={
                canWrite ? (
                  <ActionButton
                    intent="primary"
                    startIcon={<GitPullRequestArrow size={16} />}
                    disabled={!flags.data?.length}
                    onClick={() => setDialog('rollout')}
                  >
                    {t('featureRollouts.actions.newRollout')}
                  </ActionButton>
                ) : undefined
              }
            />
          )}
        </Box>
      </Paper>
      {selected && (
        <RolloutInspector
          rollout={selected}
          canWrite={canWrite}
          canApprove={canApprove}
          onAction={setDialog}
        />
      )}
      <EvaluationPreview flags={flags.data ?? []} tenants={tenants.data?.content ?? []} />
      {dialog === 'flag' && (
        <FlagDialog
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSave={async (request) => {
            await mutation.mutateAsync(() => createProviderFeatureFlag(request));
          }}
        />
      )}
      {dialog === 'rollout' && (
        <RolloutDialog
          flags={flags.data ?? []}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSave={async (featureKey, request) => {
            const created = await mutation.mutateAsync(() =>
              createProviderFeatureRollout(featureKey, request)
            );
            if (created && typeof created === 'object' && 'rolloutRevisionId' in created) {
              setSelectedId(String(created.rolloutRevisionId));
            }
          }}
        />
      )}
      {selected && dialog && !['flag', 'rollout'].includes(dialog) && (
        <ActionDialog
          rollout={selected}
          action={dialog as RolloutAction}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason, health) => runAction(dialog as RolloutAction, reason, health)}
        />
      )}
    </Stack>
  );
}
