import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  FileClock,
  FilePlus2,
  GitCompareArrows,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProviderDataPolicy,
  createProviderDataPolicyRevision,
  decideProviderDataPolicy,
  getProviderOperatorProfile,
  listProviderDataPolicies,
  previewProviderDataPolicy,
  publishProviderDataPolicy,
  rollbackProviderDataPolicy,
  submitProviderDataPolicy,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  ProviderDataAsset,
  ProviderDatabaseAssetSummary,
  ProviderDataPolicy,
  ProviderDataPolicyRevision,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

type PolicyAction = 'preview' | 'submit' | 'approve' | 'reject' | 'publish' | 'rollback';

type RuleState = {
  classification: string;
  allowedFields: string;
  purpose: string;
  allowedRegions: string;
  retentionDays: string;
  deletionSlaDays: string;
  deletionMode: string;
  holdKey: string;
  holdActive: boolean;
  restrictedFields: string;
  restrictedHandling: string;
  tenantColumns: string;
};

const POLICY_TYPES: ProviderDataPolicy['policyType'][] = [
  'CLASSIFICATION',
  'MINIMIZATION',
  'RESIDENCY',
  'RETENTION',
  'DELETION',
  'LEGAL_HOLD',
  'RESTRICTED_FIELD',
  'TENANT_RLS',
];

const initialRule: RuleState = {
  classification: 'CONFIDENTIAL',
  allowedFields: '',
  purpose: '',
  allowedRegions: 'ap-northeast-2',
  retentionDays: '365',
  deletionSlaDays: '30',
  deletionMode: 'ANONYMIZE',
  holdKey: '',
  holdActive: true,
  restrictedFields: '',
  restrictedHandling: 'MASK',
  tenantColumns: 'tenant_id,provider_tenant_id',
};

function csv(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function ruleFromState(type: ProviderDataPolicy['policyType'], state: RuleState) {
  switch (type) {
    case 'CLASSIFICATION':
      return { classification: state.classification };
    case 'MINIMIZATION':
      return { allowedFields: csv(state.allowedFields), purpose: state.purpose.trim() };
    case 'RESIDENCY':
      return { allowedRegions: csv(state.allowedRegions) };
    case 'RETENTION':
      return { retentionDays: Number(state.retentionDays) };
    case 'DELETION':
      return { deletionSlaDays: Number(state.deletionSlaDays), mode: state.deletionMode };
    case 'LEGAL_HOLD':
      return { holdKey: state.holdKey.trim(), active: state.holdActive };
    case 'RESTRICTED_FIELD':
      return { fields: csv(state.restrictedFields), handling: state.restrictedHandling };
    case 'TENANT_RLS':
      return { tenantColumns: csv(state.tenantColumns), enforcement: 'REQUIRED' };
  }
}

function stateFromRule(
  type: ProviderDataPolicy['policyType'],
  value?: Record<string, unknown>
): RuleState {
  const next = { ...initialRule };
  if (!value) return next;
  if (type === 'CLASSIFICATION' && typeof value.classification === 'string') {
    next.classification = value.classification;
  }
  if (type === 'MINIMIZATION') {
    if (Array.isArray(value.allowedFields)) next.allowedFields = value.allowedFields.join(',');
    if (typeof value.purpose === 'string') next.purpose = value.purpose;
  }
  if (type === 'RESIDENCY' && Array.isArray(value.allowedRegions)) {
    next.allowedRegions = value.allowedRegions.join(',');
  }
  if (type === 'RETENTION' && typeof value.retentionDays === 'number') {
    next.retentionDays = String(value.retentionDays);
  }
  if (type === 'DELETION') {
    if (typeof value.deletionSlaDays === 'number') {
      next.deletionSlaDays = String(value.deletionSlaDays);
    }
    if (typeof value.mode === 'string') next.deletionMode = value.mode;
  }
  if (type === 'LEGAL_HOLD') {
    if (typeof value.holdKey === 'string') next.holdKey = value.holdKey;
    if (typeof value.active === 'boolean') next.holdActive = value.active;
  }
  if (type === 'RESTRICTED_FIELD') {
    if (Array.isArray(value.fields)) next.restrictedFields = value.fields.join(',');
    if (typeof value.handling === 'string') next.restrictedHandling = value.handling;
  }
  if (type === 'TENANT_RLS' && Array.isArray(value.tenantColumns)) {
    next.tenantColumns = value.tenantColumns.join(',');
  }
  return next;
}

function RuleFields({
  type,
  value,
  onChange,
}: {
  type: ProviderDataPolicy['policyType'];
  value: RuleState;
  onChange: (next: RuleState) => void;
}) {
  const { t } = useTranslation('provider');
  const set = <K extends keyof RuleState>(key: K, next: RuleState[K]) =>
    onChange({ ...value, [key]: next });
  if (type === 'CLASSIFICATION') {
    return (
      <SelectField
        label={t('dataGovernance.policy.fields.classification')}
        value={value.classification}
        options={['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map((item) => ({
          value: item,
          label: t(`dataGovernance.classification.${item}`),
        }))}
        onValueChange={(next) => set('classification', next)}
      />
    );
  }
  if (type === 'MINIMIZATION') {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <FormField
          required
          label={t('dataGovernance.policy.fields.allowedFields')}
          value={value.allowedFields}
          onChange={(event) => set('allowedFields', event.target.value)}
          supportingText={t('dataGovernance.policy.fields.csvHint')}
        />
        <FormField
          required
          label={t('dataGovernance.policy.fields.purpose')}
          value={value.purpose}
          onChange={(event) => set('purpose', event.target.value)}
        />
      </Stack>
    );
  }
  if (type === 'RESIDENCY') {
    return (
      <FormField
        required
        label={t('dataGovernance.policy.fields.allowedRegions')}
        value={value.allowedRegions}
        onChange={(event) => set('allowedRegions', event.target.value)}
        supportingText={t('dataGovernance.policy.fields.csvHint')}
      />
    );
  }
  if (type === 'RETENTION') {
    return (
      <FormField
        required
        type="number"
        label={t('dataGovernance.policy.fields.retentionDays')}
        value={value.retentionDays}
        onChange={(event) => set('retentionDays', event.target.value)}
        slotProps={{ htmlInput: { min: 1 } }}
      />
    );
  }
  if (type === 'DELETION') {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <FormField
          required
          type="number"
          label={t('dataGovernance.policy.fields.deletionSlaDays')}
          value={value.deletionSlaDays}
          onChange={(event) => set('deletionSlaDays', event.target.value)}
          slotProps={{ htmlInput: { min: 1 } }}
        />
        <SelectField
          label={t('dataGovernance.policy.fields.deletionMode')}
          value={value.deletionMode}
          options={['SOFT_DELETE', 'HARD_DELETE', 'ANONYMIZE'].map((item) => ({
            value: item,
            label: t(`dataGovernance.policy.deletionModes.${item}`),
          }))}
          onValueChange={(next) => set('deletionMode', next)}
        />
      </Stack>
    );
  }
  if (type === 'LEGAL_HOLD') {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }}>
        <FormField
          required
          label={t('dataGovernance.policy.fields.holdKey')}
          value={value.holdKey}
          onChange={(event) => set('holdKey', event.target.value)}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.holdActive}
              onChange={(event) => set('holdActive', event.target.checked)}
            />
          }
          label={t('dataGovernance.policy.fields.holdActive')}
          sx={{ flexShrink: 0 }}
        />
      </Stack>
    );
  }
  if (type === 'RESTRICTED_FIELD') {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <FormField
          required
          label={t('dataGovernance.policy.fields.restrictedFields')}
          value={value.restrictedFields}
          onChange={(event) => set('restrictedFields', event.target.value)}
          supportingText={t('dataGovernance.policy.fields.csvHint')}
        />
        <SelectField
          label={t('dataGovernance.policy.fields.handling')}
          value={value.restrictedHandling}
          options={['MASK', 'DENY', 'TOKENIZE'].map((item) => ({
            value: item,
            label: t(`dataGovernance.policy.handling.${item}`),
          }))}
          onValueChange={(next) => set('restrictedHandling', next)}
        />
      </Stack>
    );
  }
  return (
    <FormField
      required
      label={t('dataGovernance.policy.fields.tenantColumns')}
      value={value.tenantColumns}
      onChange={(event) => set('tenantColumns', event.target.value)}
      supportingText={t('dataGovernance.policy.fields.tenantRlsHint')}
    />
  );
}

function PolicyEditorDialog({
  assets,
  databases,
  policy,
  busy,
  onClose,
  onCreatePolicy,
  onCreateRevision,
}: {
  assets: ProviderDataAsset[];
  databases: ProviderDatabaseAssetSummary[];
  policy?: ProviderDataPolicy;
  busy: boolean;
  onClose: () => void;
  onCreatePolicy: (request: Parameters<typeof createProviderDataPolicy>[0]) => Promise<void>;
  onCreateRevision: (
    policyId: string,
    request: Parameters<typeof createProviderDataPolicyRevision>[1]
  ) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const latest = policy?.revisions[0];
  const [policyKey, setPolicyKey] = useState(policy?.policyKey ?? '');
  const [displayName, setDisplayName] = useState(policy?.displayName ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [type, setType] = useState<ProviderDataPolicy['policyType']>(
    policy?.policyType ?? 'CLASSIFICATION'
  );
  const [scopeType, setScopeType] = useState<ProviderDataPolicy['scopeType']>(
    policy?.scopeType ?? 'GLOBAL'
  );
  const [scopeRef, setScopeRef] = useState(policy?.scopeRef ?? '');
  const [ownerService, setOwnerService] = useState(policy?.ownerService ?? 'dwp-provider-server');
  const [rule, setRule] = useState<RuleState>(
    stateFromRule(policy?.policyType ?? 'CLASSIFICATION', latest?.policyRule)
  );
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scopeOptions = useMemo(() => {
    if (scopeType === 'DATABASE') {
      return databases.map((item) => ({ key: item.databaseKey, label: item.displayName }));
    }
    if (scopeType === 'ASSET') {
      return assets
        .filter((item) => !['PARTITION', 'SYSTEM_TABLE'].includes(item.objectType))
        .map((item) => ({ key: item.assetKey, label: item.assetKey }));
    }
    return [];
  }, [assets, databases, scopeType]);
  const save = async () => {
    try {
      const policyRule = ruleFromState(type, rule);
      if (policy) {
        await onCreateRevision(policy.policyId, {
          policyRule,
          justification: justification.trim(),
        });
      } else {
        await onCreatePolicy({
          policyKey: policyKey.trim(),
          displayName: displayName.trim(),
          description: description.trim(),
          policyType: type,
          scopeType,
          scopeRef: scopeType === 'GLOBAL' ? null : scopeRef,
          ownerService: ownerService.trim(),
          policyRule,
          justification: justification.trim(),
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.operation'));
    }
  };
  return (
    <FormDialog
      open
      maxWidth="md"
      title={
        policy
          ? t('dataGovernance.policy.editor.revisionTitle')
          : t('dataGovernance.policy.editor.policyTitle')
      }
      cancelLabel={t('actions.cancel')}
      submitLabel={
        policy
          ? t('dataGovernance.policy.actions.createRevision')
          : t('dataGovernance.policy.actions.createPolicy')
      }
      busy={busy}
      submitDisabled={
        !justification.trim() ||
        (!policy &&
          (!policyKey.trim() ||
            !displayName.trim() ||
            !description.trim() ||
            !ownerService.trim() ||
            (scopeType !== 'GLOBAL' && !scopeRef)))
      }
      onClose={onClose}
      onSubmit={save}
    >
      <Stack gap={2}>
        <Alert severity="info">{t('dataGovernance.policy.editor.guidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        {!policy && (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <FormField
                required
                label={t('dataGovernance.policy.fields.policyKey')}
                value={policyKey}
                onChange={(event) => setPolicyKey(event.target.value)}
                supportingText={t('dataGovernance.policy.editor.keyHint')}
              />
              <FormField
                required
                label={t('dataGovernance.policy.fields.displayName')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Stack>
            <FormField
              required
              multiline
              minRows={2}
              label={t('dataGovernance.policy.fields.description')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
              <SelectField
                label={t('dataGovernance.policy.fields.policyType')}
                value={type}
                options={POLICY_TYPES.map((item) => ({
                  value: item,
                  label: t(`dataGovernance.policy.types.${item}`),
                }))}
                onValueChange={(next) => {
                  setType(next as ProviderDataPolicy['policyType']);
                  setRule({ ...initialRule });
                }}
              />
              <SelectField
                label={t('dataGovernance.policy.fields.scopeType')}
                value={scopeType}
                options={(['GLOBAL', 'DATABASE', 'ASSET'] as const).map((item) => ({
                  value: item,
                  label: t(`dataGovernance.policy.scopes.${item}`),
                }))}
                onValueChange={(next) => {
                  setScopeType(next as ProviderDataPolicy['scopeType']);
                  setScopeRef('');
                }}
              />
              {scopeType !== 'GLOBAL' && (
                <SelectField
                  required
                  label={t('dataGovernance.policy.fields.scopeRef')}
                  value={scopeRef}
                  options={scopeOptions.map((item) => ({
                    value: item.key,
                    label: item.label,
                  }))}
                  onValueChange={setScopeRef}
                />
              )}
            </Stack>
            <FormField
              required
              label={t('dataGovernance.policy.fields.ownerService')}
              value={ownerService}
              onChange={(event) => setOwnerService(event.target.value)}
            />
          </>
        )}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('dataGovernance.policy.fields.rule')}
          </Typography>
          <RuleFields type={type} value={rule} onChange={setRule} />
        </Box>
        <FormField
          required
          multiline
          minRows={3}
          label={t('dataGovernance.policy.fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function PolicyActionDialog({
  policy,
  revision,
  action,
  busy,
  onClose,
  onSubmit,
}: {
  policy: ProviderDataPolicy;
  revision: ProviderDataPolicyRevision;
  action: PolicyAction;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const dangerous = ['reject', 'rollback'].includes(action);
  return (
    <FormDialog
      open
      title={t(`dataGovernance.policy.actionDialog.${action}.title`)}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(`dataGovernance.policy.actions.${action}`)}
      submitIntent={dangerous ? 'danger' : 'primary'}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <Stack gap={2}>
        <Box>
          <Typography variant="subtitle2" fontWeight={750}>
            {policy.displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dataGovernance.policy.revisionIdentity', {
              key: policy.policyKey,
              revision: revision.revisionNumber,
            })}
          </Typography>
        </Box>
        <Alert severity={dangerous ? 'warning' : 'info'}>
          {t(`dataGovernance.policy.actionDialog.${action}.description`)}
        </Alert>
        <FormField
          required
          multiline
          minRows={3}
          label={t('dataGovernance.policy.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function RevisionInspector({
  policy,
  revision,
  canWrite,
  canApprove,
  onNewRevision,
  onAction,
}: {
  policy: ProviderDataPolicy;
  revision: ProviderDataPolicyRevision;
  canWrite: boolean;
  canApprove: boolean;
  onNewRevision: () => void;
  onAction: (action: PolicyAction) => void;
}) {
  const { t } = useTranslation('provider');
  const actions: Array<{ action: PolicyAction; icon: ReactNode }> = [];
  if (canWrite && revision.lifecycleState === 'DRAFT') {
    actions.push({ action: 'preview', icon: <GitCompareArrows size={16} /> });
    if (revision.impact?.publishable) actions.push({ action: 'submit', icon: <Send size={16} /> });
  }
  if (canApprove && revision.lifecycleState === 'PENDING_APPROVAL') {
    actions.push({ action: 'approve', icon: <Check size={16} /> });
    actions.push({ action: 'reject', icon: <X size={16} /> });
  }
  if (canWrite && revision.lifecycleState === 'APPROVED') {
    actions.push({ action: 'publish', icon: <Upload size={16} /> });
  }
  if (canWrite && revision.lifecycleState === 'ACTIVE' && revision.previousRevisionId) {
    actions.push({ action: 'rollback', icon: <RotateCcw size={16} /> });
  }
  return (
    <Stack gap={2.25} sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <ProviderSectionHeading
        title={`${policy.displayName} · v${revision.revisionNumber}`}
        description={policy.description}
        action={<ProviderStatusChip state={revision.lifecycleState} />}
      />
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Chip
          size="small"
          variant="outlined"
          label={t(`dataGovernance.policy.types.${policy.policyType}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t(`dataGovernance.policy.scopes.${policy.scopeType}`)}
        />
        {policy.scopeRef && <Chip size="small" variant="outlined" label={policy.scopeRef} />}
        <Chip size="small" variant="outlined" label={policy.ownerService} />
      </Stack>
      <Box>
        <Typography variant="subtitle2">{t('dataGovernance.policy.fields.rule')}</Typography>
        <Typography
          component="pre"
          variant="body2"
          sx={{ m: 0, mt: 0.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {JSON.stringify(revision.policyRule, null, 2)}
        </Typography>
      </Box>
      <Divider />
      <Box>
        <Typography variant="subtitle2">{t('dataGovernance.policy.impact.title')}</Typography>
        {!revision.impact ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            {t('dataGovernance.policy.impact.notPreviewed')}
          </Alert>
        ) : (
          <Stack gap={1.25} sx={{ mt: 1 }}>
            <Alert severity={revision.impact.publishable ? 'success' : 'error'}>
              {t('dataGovernance.policy.impact.summary', {
                count: revision.impact.affectedAssetCount,
                blockers: revision.impact.blockers.length,
                warnings: revision.impact.warnings.length,
              })}
            </Alert>
            {!!revision.impact.blockers.length && (
              <Alert severity="error">
                <Typography variant="subtitle2">
                  {t('dataGovernance.policy.impact.blockers')}
                </Typography>
                {revision.impact.blockers.map((item) => (
                  <Typography key={item} variant="body2" sx={{ mt: 0.35 }}>
                    {t(`dataGovernance.policy.impact.codes.${item.split(':')[0]}`, {
                      detail: item.split(':').slice(1).join(':'),
                      defaultValue: item,
                    })}
                  </Typography>
                ))}
              </Alert>
            )}
            {!!revision.impact.warnings.length && (
              <Alert severity="warning">
                <Typography variant="subtitle2">
                  {t('dataGovernance.policy.impact.warnings')}
                </Typography>
                {revision.impact.warnings.map((item) => (
                  <Typography key={item} variant="body2" sx={{ mt: 0.35 }}>
                    {t(`dataGovernance.policy.impact.codes.${item.split(':')[0]}`, {
                      detail: item.split(':').slice(1).join(':'),
                      defaultValue: item,
                    })}
                  </Typography>
                ))}
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary">
              {t('dataGovernance.policy.impact.generated', {
                value: formatProviderDate(revision.impact.previewedAt),
                hash: revision.impact.impactHash.slice(0, 12),
              })}
            </Typography>
          </Stack>
        )}
      </Box>
      <Divider />
      <Box>
        <Typography variant="subtitle2">{t('dataGovernance.policy.history')}</Typography>
        <Stack gap={0.75} sx={{ mt: 1 }}>
          {policy.revisions.map((item) => (
            <Stack key={item.revisionId} direction="row" alignItems="center" gap={1}>
              <FileClock size={15} />
              <Typography variant="body2" sx={{ minWidth: 64 }}>
                {t('dataGovernance.policy.revision', { revision: item.revisionNumber })}
              </Typography>
              <ProviderStatusChip state={item.lifecycleState} />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {formatProviderDate(item.publishedAt ?? item.approvedAt ?? item.submittedAt)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {canWrite &&
          !['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(revision.lifecycleState) && (
            <ActionButton
              intent="secondary"
              startIcon={<FilePlus2 size={16} />}
              onClick={onNewRevision}
            >
              {t('dataGovernance.policy.actions.createRevision')}
            </ActionButton>
          )}
        {actions.map(({ action, icon }) => (
          <ActionButton
            key={action}
            intent={['reject', 'rollback'].includes(action) ? 'danger' : 'secondary'}
            startIcon={icon}
            onClick={() => onAction(action)}
          >
            {t(`dataGovernance.policy.actions.${action}`)}
          </ActionButton>
        ))}
      </Stack>
    </Stack>
  );
}

export function ProviderDataPolicyStudio({
  assets,
  databases,
}: {
  assets: ProviderDataAsset[];
  databases: ProviderDatabaseAssetSummary[];
}) {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>();
  const [dialog, setDialog] = useState<'policy' | 'revision' | PolicyAction | null>(null);
  const policies = useQuery({
    queryKey: ['provider', 'data-governance', 'policies'],
    queryFn: listProviderDataPolicies,
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const selectedPolicy =
    (policies.data ?? []).find((policy) => policy.policyId === selectedPolicyId) ??
    policies.data?.[0];
  const selectedRevision =
    selectedPolicy?.revisions.find((revision) => revision.revisionId === selectedRevisionId) ??
    selectedPolicy?.revisions[0];
  const canWrite = operator.data?.permissions.includes('DATA_GOVERNANCE_WRITE') ?? false;
  const canApprove = operator.data?.permissions.includes('DATA_GOVERNANCE_APPROVE') ?? false;
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['provider', 'data-governance', 'policies'],
      });
      setDialog(null);
      toast.success(t('dataGovernance.policy.completed'));
    },
    onError: (error) => toast.error(providerError(error, t('errors.operation'))),
  });

  if (policies.isLoading || operator.isLoading) return <ProviderLoading />;
  if (policies.isError || operator.isError) {
    return <ProviderError error={policies.error ?? operator.error} />;
  }

  const runAction = async (action: PolicyAction, reason: string) => {
    if (!selectedRevision) return;
    await mutation.mutateAsync(() => {
      switch (action) {
        case 'preview':
          return previewProviderDataPolicy(selectedRevision, reason);
        case 'submit':
          return submitProviderDataPolicy(selectedRevision, reason);
        case 'approve':
          return decideProviderDataPolicy(selectedRevision, 'APPROVED', reason);
        case 'reject':
          return decideProviderDataPolicy(selectedRevision, 'REJECTED', reason);
        case 'publish':
          return publishProviderDataPolicy(selectedRevision, reason);
        case 'rollback':
          return rollbackProviderDataPolicy(selectedRevision, reason);
      }
    });
  };

  return (
    <Stack gap={2}>
      <Alert severity="info" icon={<ShieldCheck size={20} />}>
        {t('dataGovernance.policy.guidance')}
      </Alert>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box>
          <Typography variant="h6">{t('dataGovernance.policy.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dataGovernance.policy.description')}
          </Typography>
        </Box>
        {canWrite && (
          <ActionButton
            intent="primary"
            startIcon={<Plus size={16} />}
            onClick={() => setDialog('policy')}
          >
            {t('dataGovernance.policy.actions.createPolicy')}
          </ActionButton>
        )}
      </Stack>
      {(policies.data ?? []).length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '360px minmax(0, 1fr)' },
            border: 1,
            borderColor: 'divider',
            minHeight: 620,
          }}
        >
          <Box
            sx={{
              borderRight: { lg: 1 },
              borderBottom: { xs: 1, lg: 0 },
              borderColor: 'divider',
              maxHeight: 720,
              overflowY: 'auto',
            }}
          >
            {(policies.data ?? []).map((policy) => {
              const latest = policy.revisions[0];
              return (
                <ListItemButton
                  key={policy.policyId}
                  selected={policy.policyId === selectedPolicy?.policyId}
                  onClick={() => {
                    setSelectedPolicyId(policy.policyId);
                    setSelectedRevisionId(policy.revisions[0]?.revisionId);
                  }}
                  sx={{
                    alignItems: 'flex-start',
                    px: 1.75,
                    py: 1.4,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Stack gap={0.5} sx={{ minWidth: 0, width: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="subtitle2" fontWeight={750} noWrap sx={{ flex: 1 }}>
                        {policy.displayName}
                      </Typography>
                      {latest && <ProviderStatusChip state={latest.lifecycleState} />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {t(`dataGovernance.policy.types.${policy.policyType}`)} · {policy.policyKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {t(`dataGovernance.policy.scopes.${policy.scopeType}`)}
                      {policy.scopeRef ? ` · ${policy.scopeRef}` : ''}
                    </Typography>
                  </Stack>
                </ListItemButton>
              );
            })}
          </Box>
          {selectedPolicy && selectedRevision ? (
            <RevisionInspector
              policy={selectedPolicy}
              revision={selectedRevision}
              canWrite={canWrite}
              canApprove={canApprove}
              onNewRevision={() => setDialog('revision')}
              onAction={setDialog}
            />
          ) : (
            <EmptyState title={t('dataGovernance.policy.emptySelection')} size="page" />
          )}
        </Box>
      ) : (
        <EmptyState
          title={t('dataGovernance.policy.empty.title')}
          description={t('dataGovernance.policy.empty.description')}
          action={
            canWrite ? (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={16} />}
                onClick={() => setDialog('policy')}
              >
                {t('dataGovernance.policy.actions.createPolicy')}
              </ActionButton>
            ) : undefined
          }
          size="page"
        />
      )}
      {(dialog === 'policy' || (dialog === 'revision' && selectedPolicy)) && (
        <PolicyEditorDialog
          assets={assets}
          databases={databases}
          policy={dialog === 'revision' ? selectedPolicy : undefined}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onCreatePolicy={async (request) => {
            const created = await mutation.mutateAsync(() => createProviderDataPolicy(request));
            if (created && typeof created === 'object' && 'policyId' in created) {
              setSelectedPolicyId(String(created.policyId));
            }
          }}
          onCreateRevision={async (policyId, request) => {
            const created = await mutation.mutateAsync(() =>
              createProviderDataPolicyRevision(policyId, request)
            );
            if (created && typeof created === 'object' && 'revisionId' in created) {
              setSelectedRevisionId(String(created.revisionId));
            }
          }}
        />
      )}
      {selectedPolicy && selectedRevision && dialog && !['policy', 'revision'].includes(dialog) && (
        <PolicyActionDialog
          policy={selectedPolicy}
          revision={selectedRevision}
          action={dialog as PolicyAction}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason) => runAction(dialog as PolicyAction, reason)}
        />
      )}
    </Stack>
  );
}
