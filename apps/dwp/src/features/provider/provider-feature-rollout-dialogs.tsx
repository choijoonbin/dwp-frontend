import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type {
  createProviderFeatureFlag,
  createProviderFeatureRollout,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderFeatureFlag, ProviderFeatureRollout } from '@dwp-frontend/shared-utils';

import {
  RolloutFormError,
  buildFeatureSchema,
  buildFeatureValue,
  buildHealthEvidence,
  buildStages,
  buildTargeting,
} from './provider-feature-rollout-form-model';

import type {
  FeatureSchemaDraft,
  FeatureValueDraft,
  HealthGateDraft,
  RolloutStageDraft,
  RolloutTargetingDraft,
  TypedEntryDraft,
} from './provider-feature-rollout-form-model';

export type RolloutAction =
  'submit' | 'approve' | 'reject' | 'activate' | 'pause' | 'resume' | 'advance' | 'rollback';

const emptyValue = (): FeatureValueDraft => ({ primitive: 'false', entries: [] });
const emptySchema = (): FeatureSchemaDraft => ({
  description: '',
  minimum: '',
  maximum: '',
  requiredKeys: [],
});
const emptyGate = (): HealthGateDraft => ({
  maxErrorRate: '1',
  maxP95LatencyMs: '800',
  minSuccessRate: '99',
});
const initialStages = (): RolloutStageDraft[] =>
  [5, 25, 100].map((percentage) => ({
    id: crypto.randomUUID(),
    exposurePercentage: String(percentage),
    minimumObservationMinutes: '30',
    gate: emptyGate(),
  }));

function errorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof RolloutFormError) {
    return t(`featureRollouts.validation.${error.issue}`);
  }
  return t('errors.operation');
}

function DynamicStringList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation('provider');
  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">{label}</Typography>
      {values.map((value, index) => (
        <Stack key={index} direction="row" gap={1} alignItems="flex-start">
          <FormField
            label={t('featureRollouts.fields.listValue')}
            value={value}
            onChange={(event) =>
              onChange(
                values.map((candidate, itemIndex) =>
                  itemIndex === index ? event.target.value : candidate
                )
              )
            }
          />
          <ActionButton
            intent="quiet"
            aria-label={t('featureRollouts.actions.removeValue')}
            onClick={() => onChange(values.filter((_candidate, itemIndex) => itemIndex !== index))}
          >
            <Trash2 size={16} />
          </ActionButton>
        </Stack>
      ))}
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<Plus size={16} />}
        onClick={() => onChange([...values, ''])}
      >
        {t('featureRollouts.actions.addValue')}
      </ActionButton>
    </Stack>
  );
}

function TypedValueEditor({
  valueType,
  value,
  onChange,
}: {
  valueType: ProviderFeatureFlag['valueType'];
  value: FeatureValueDraft;
  onChange: (value: FeatureValueDraft) => void;
}) {
  const { t } = useTranslation('provider');
  if (valueType === 'BOOLEAN') {
    return (
      <SelectField
        label={t('featureRollouts.fields.typedValue')}
        value={value.primitive}
        options={['true', 'false'].map((candidate) => ({
          value: candidate,
          label: t(`featureRollouts.boolean.${candidate}`),
        }))}
        onValueChange={(primitive) => onChange({ ...value, primitive })}
      />
    );
  }
  if (valueType !== 'JSON') {
    return (
      <FormField
        required
        type={valueType === 'NUMBER' ? 'number' : 'text'}
        label={t('featureRollouts.fields.typedValue')}
        value={value.primitive}
        onChange={(event) => onChange({ ...value, primitive: event.target.value })}
      />
    );
  }
  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">{t('featureRollouts.fields.objectEntries')}</Typography>
      {value.entries.map((entry) => (
        <Stack key={entry.id} direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <FormField
            required
            label={t('featureRollouts.fields.objectKey')}
            value={entry.key}
            onChange={(event) =>
              onChange({
                ...value,
                entries: value.entries.map((candidate) =>
                  candidate.id === entry.id ? { ...candidate, key: event.target.value } : candidate
                ),
              })
            }
          />
          <SelectField
            label={t('featureRollouts.fields.objectValueType')}
            value={entry.kind}
            options={(['STRING', 'NUMBER', 'BOOLEAN'] as const).map((kind) => ({
              value: kind,
              label: t(`featureRollouts.valueTypes.${kind}`),
            }))}
            onValueChange={(kind) =>
              updateEntry(
                value,
                entry.id,
                { kind: kind as TypedEntryDraft['kind'], value: '' },
                onChange
              )
            }
          />
          {entry.kind === 'BOOLEAN' ? (
            <SelectField
              label={t('featureRollouts.fields.objectValue')}
              value={entry.value || 'false'}
              options={['true', 'false'].map((candidate) => ({
                value: candidate,
                label: t(`featureRollouts.boolean.${candidate}`),
              }))}
              onValueChange={(next) => updateEntry(value, entry.id, { value: next }, onChange)}
            />
          ) : (
            <FormField
              required
              type={entry.kind === 'NUMBER' ? 'number' : 'text'}
              label={t('featureRollouts.fields.objectValue')}
              value={entry.value}
              onChange={(event) =>
                updateEntry(value, entry.id, { value: event.target.value }, onChange)
              }
            />
          )}
          <ActionButton
            intent="quiet"
            aria-label={t('featureRollouts.actions.removeValue')}
            onClick={() =>
              onChange({
                ...value,
                entries: value.entries.filter((candidate) => candidate.id !== entry.id),
              })
            }
          >
            <Trash2 size={16} />
          </ActionButton>
        </Stack>
      ))}
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<Plus size={16} />}
        onClick={() =>
          onChange({
            ...value,
            entries: [
              ...value.entries,
              { id: crypto.randomUUID(), key: '', kind: 'STRING', value: '' },
            ],
          })
        }
      >
        {t('featureRollouts.actions.addObjectEntry')}
      </ActionButton>
    </Stack>
  );
}

function updateEntry(
  value: FeatureValueDraft,
  id: string,
  patch: Partial<TypedEntryDraft>,
  onChange: (value: FeatureValueDraft) => void
) {
  onChange({
    ...value,
    entries: value.entries.map((candidate) =>
      candidate.id === id ? { ...candidate, ...patch } : candidate
    ),
  });
}

function HealthFields({
  value,
  onChange,
}: {
  value: HealthGateDraft;
  onChange: (value: HealthGateDraft) => void;
}) {
  const { t } = useTranslation('provider');
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
      {(['maxErrorRate', 'maxP95LatencyMs', 'minSuccessRate'] as const).map((key) => (
        <FormField
          key={key}
          type="number"
          label={t(`featureRollouts.fields.${key}`)}
          value={value[key]}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          slotProps={{ htmlInput: { min: 0, step: key === 'maxP95LatencyMs' ? 1 : 0.1 } }}
        />
      ))}
    </Stack>
  );
}

export function FeatureFlagDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (request: Parameters<typeof createProviderFeatureFlag>[0]) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [identity, setIdentity] = useState({
    featureKey: '',
    displayName: '',
    description: '',
    ownerService: 'dwp-platform-server',
  });
  const [valueType, setValueType] = useState<ProviderFeatureFlag['valueType']>('BOOLEAN');
  const [value, setValue] = useState<FeatureValueDraft>(emptyValue);
  const [schema, setSchema] = useState<FeatureSchemaDraft>(emptySchema);
  const [riskTier, setRiskTier] = useState<ProviderFeatureFlag['riskTier']>('L2');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await onSave({
        ...identity,
        featureKey: identity.featureKey.trim(),
        displayName: identity.displayName.trim(),
        description: identity.description.trim(),
        ownerService: identity.ownerService.trim(),
        valueType,
        defaultValue: buildFeatureValue(valueType, value),
        configurationSchema: buildFeatureSchema(valueType, schema),
        riskTier,
      });
    } catch (caught) {
      setError(errorMessage(caught, t));
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
        !identity.featureKey.trim() ||
        !identity.displayName.trim() ||
        !identity.description.trim() ||
        !identity.ownerService.trim()
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
            value={identity.featureKey}
            onChange={(event) => setIdentity({ ...identity, featureKey: event.target.value })}
            supportingText={t('featureRollouts.createFlag.keyHint')}
          />
          <FormField
            required
            label={t('featureRollouts.fields.displayName')}
            value={identity.displayName}
            onChange={(event) => setIdentity({ ...identity, displayName: event.target.value })}
          />
        </Stack>
        <FormField
          required
          multiline
          minRows={2}
          label={t('featureRollouts.fields.description')}
          value={identity.description}
          onChange={(event) => setIdentity({ ...identity, description: event.target.value })}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            label={t('featureRollouts.fields.ownerService')}
            value={identity.ownerService}
            onChange={(event) => setIdentity({ ...identity, ownerService: event.target.value })}
          />
          <SelectField
            label={t('featureRollouts.fields.valueType')}
            value={valueType}
            options={(['BOOLEAN', 'STRING', 'NUMBER', 'JSON'] as const).map((type) => ({
              value: type,
              label: t(`featureRollouts.valueTypes.${type}`),
            }))}
            onValueChange={(next) => {
              setValueType(next as ProviderFeatureFlag['valueType']);
              setValue(emptyValue());
              setSchema(emptySchema());
            }}
          />
          <SelectField
            label={t('featureRollouts.fields.riskTier')}
            value={riskTier}
            options={(['L1', 'L2', 'L3'] as const).map((tier) => ({
              value: tier,
              label: t(`featureRollouts.riskTiers.${tier}`),
            }))}
            onValueChange={(next) => setRiskTier(next as ProviderFeatureFlag['riskTier'])}
          />
        </Stack>
        <TypedValueEditor valueType={valueType} value={value} onChange={setValue} />
        <Divider />
        <Typography variant="subtitle2">{t('featureRollouts.fields.schema')}</Typography>
        <FormField
          label={t('featureRollouts.fields.schemaDescription')}
          value={schema.description}
          onChange={(event) => setSchema({ ...schema, description: event.target.value })}
        />
        {valueType === 'NUMBER' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <FormField
              type="number"
              label={t('featureRollouts.fields.minimum')}
              value={schema.minimum}
              onChange={(event) => setSchema({ ...schema, minimum: event.target.value })}
            />
            <FormField
              type="number"
              label={t('featureRollouts.fields.maximum')}
              value={schema.maximum}
              onChange={(event) => setSchema({ ...schema, maximum: event.target.value })}
            />
          </Stack>
        )}
        {valueType === 'JSON' && (
          <DynamicStringList
            label={t('featureRollouts.fields.requiredKeys')}
            values={schema.requiredKeys}
            onChange={(requiredKeys) => setSchema({ ...schema, requiredKeys })}
          />
        )}
      </Stack>
    </FormDialog>
  );
}

export function FeatureRolloutDialog({
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
  const [value, setValue] = useState<FeatureValueDraft>(emptyValue);
  const [targeting, setTargeting] = useState<RolloutTargetingDraft>({
    tenantIds: [],
    tenantKeys: [],
    regions: [],
    serviceTiers: [],
    isolationModels: [],
  });
  const [strategy, setStrategy] = useState<ProviderFeatureRollout['strategy']>('RING');
  const [stages, setStages] = useState<RolloutStageDraft[]>(initialStages);
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      if (!selectedFlag) throw new RolloutFormError('VALUE_REQUIRED');
      await onSave(featureKey, {
        name: name.trim(),
        rolloutValue: buildFeatureValue(selectedFlag.valueType, value),
        targeting: buildTargeting(targeting),
        strategy,
        justification: justification.trim(),
        stages: buildStages(strategy, stages, (index, percentage) =>
          t('featureRollouts.stageName', { index, percentage })
        ),
      });
    } catch (caught) {
      setError(errorMessage(caught, t));
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
            onValueChange={(next) => {
              setFeatureKey(next);
              setValue(emptyValue());
            }}
          />
          <FormField
            required
            label={t('featureRollouts.fields.rolloutName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <SelectField
            label={t('featureRollouts.fields.strategy')}
            value={strategy}
            options={(['RING', 'PERCENTAGE', 'ALL_AT_ONCE'] as const).map((item) => ({
              value: item,
              label: t(`featureRollouts.strategies.${item}`),
            }))}
            onValueChange={(next) => {
              const typed = next as ProviderFeatureRollout['strategy'];
              setStrategy(typed);
              if (typed === 'ALL_AT_ONCE')
                setStages([
                  {
                    id: crypto.randomUUID(),
                    exposurePercentage: '100',
                    minimumObservationMinutes: '0',
                    gate: emptyGate(),
                  },
                ]);
            }}
          />
        </Stack>
        {selectedFlag && (
          <TypedValueEditor valueType={selectedFlag.valueType} value={value} onChange={setValue} />
        )}
        <Divider />
        <Typography variant="subtitle2">{t('featureRollouts.fields.targeting')}</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {(Object.keys(targeting) as Array<keyof RolloutTargetingDraft>).map((key) => (
            <DynamicStringList
              key={key}
              label={t(`featureRollouts.targeting.${key}`)}
              values={targeting[key]}
              onChange={(values) => setTargeting({ ...targeting, [key]: values })}
            />
          ))}
        </Box>
        <Divider />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2">{t('featureRollouts.stagePlan')}</Typography>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Plus size={16} />}
            disabled={strategy === 'ALL_AT_ONCE' || stages.length >= 20}
            onClick={() =>
              setStages([
                ...stages,
                {
                  id: crypto.randomUUID(),
                  exposurePercentage: '',
                  minimumObservationMinutes: '30',
                  gate: emptyGate(),
                },
              ])
            }
          >
            {t('featureRollouts.actions.addStage')}
          </ActionButton>
        </Stack>
        {stages.map((stage, index) => (
          <Box key={stage.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="subtitle2">
                {t('featureRollouts.stageIndex', { index: index + 1 })}
              </Typography>
              <ActionButton
                intent="quiet"
                aria-label={t('featureRollouts.actions.removeStage')}
                disabled={stages.length === 1}
                onClick={() => setStages(stages.filter((candidate) => candidate.id !== stage.id))}
              >
                <Trash2 size={16} />
              </ActionButton>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1 }}>
              <FormField
                required
                type="number"
                label={t('featureRollouts.fields.stagePercentage')}
                value={stage.exposurePercentage}
                onChange={(event) =>
                  setStages(
                    stages.map((candidate) =>
                      candidate.id === stage.id
                        ? { ...candidate, exposurePercentage: event.target.value }
                        : candidate
                    )
                  )
                }
                slotProps={{ htmlInput: { min: 0.01, max: 100, step: 0.01 } }}
              />
              <FormField
                required
                type="number"
                label={t('featureRollouts.fields.observationMinutes')}
                value={stage.minimumObservationMinutes}
                onChange={(event) =>
                  setStages(
                    stages.map((candidate) =>
                      candidate.id === stage.id
                        ? { ...candidate, minimumObservationMinutes: event.target.value }
                        : candidate
                    )
                  )
                }
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            </Stack>
            <Box sx={{ mt: 1 }}>
              <HealthFields
                value={stage.gate}
                onChange={(gate) =>
                  setStages(
                    stages.map((candidate) =>
                      candidate.id === stage.id ? { ...candidate, gate } : candidate
                    )
                  )
                }
              />
            </Box>
          </Box>
        ))}
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

export function FeatureRolloutActionDialog({
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
  const [health, setHealth] = useState<HealthGateDraft>({
    maxErrorRate: '0',
    maxP95LatencyMs: '0',
    minSuccessRate: '100',
  });
  const [error, setError] = useState<string | null>(null);
  const dangerous = ['reject', 'rollback'].includes(action);
  const save = async () => {
    try {
      await onSubmit(reason.trim(), action === 'advance' ? buildHealthEvidence(health, true) : {});
    } catch (caught) {
      setError(errorMessage(caught, t));
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
        {action === 'advance' && <HealthFields value={health} onChange={setHealth} />}
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
