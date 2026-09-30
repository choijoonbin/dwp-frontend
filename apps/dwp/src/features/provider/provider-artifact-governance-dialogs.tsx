import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type {
  appendProviderArtifactRolloutEvidence,
  assessProviderArtifactCompatibility,
  createProviderArtifactManifest,
  createProviderArtifactRolloutPlan,
  decideProviderArtifactManifest,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type {
  ProviderArtifactManifest,
  ProviderArtifactRolloutPlan,
} from '@dwp-frontend/shared-utils';

import {
  ArtifactFormError,
  buildArtifactEvidence,
  buildArtifactManifest,
  buildArtifactRollback,
  buildArtifactStages,
  buildArtifactTarget,
  buildCompatibilityAssessment,
  buildCompatibilityPolicy,
  compatibilityEvidenceTemplate,
} from './provider-artifact-governance-model';

import {
  EvidenceFields,
  RequirementEditor,
  StringListEditor,
} from './provider-artifact-governance-form-fields';

import type {
  ArtifactPolicyDraft,
  ArtifactRollbackDraft,
  ArtifactStageDraft,
  ArtifactTargetDraft,
  CompatibilityEvidence,
} from './provider-artifact-governance-model';

const ARTIFACT_TYPES = ['WEB_APP', 'SERVICE', 'WORKER', 'SCHEMA', 'CONFIG_BUNDLE'] as const;
const COMPATIBILITY_STATES = ['PASSED', 'REVIEW_REQUIRED', 'BLOCKED', 'UNAVAILABLE'] as const;
const ROLLBACK_STATES = ['DECLARED', 'NOT_DECLARED', 'UNAVAILABLE'] as const;
const EVIDENCE_TYPES = [
  'COMPATIBILITY',
  'PRE_FLIGHT',
  'OBSERVATION',
  'ROLLBACK_FEASIBILITY',
  'MANUAL_RECEIPT',
] as const;
const EVIDENCE_STATES = ['PASSED', 'FAILED', 'INCONCLUSIVE', 'NOT_DISPATCHED'] as const;

function localizedError(error: unknown, t: (key: string) => string): string {
  if (error instanceof ArtifactFormError) {
    return t(`artifactGovernance.validation.${error.issue}`);
  }
  return t('errors.operation');
}

export function ReasonDialog({
  title,
  description,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open
      title={title}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('artifactGovernance.saveAction')}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await onSubmit(reason.trim());
        } catch (caught) {
          setError(localizedError(caught, t));
        }
      }}
    >
      <Stack gap={2}>
        <Alert severity="info">{description}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <FormField
          required
          multiline
          minRows={3}
          label={t('artifactGovernance.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function ManifestDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: Parameters<typeof createProviderArtifactManifest>[0]) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const [identity, setIdentity] = useState({
    productKey: '',
    artifactVersion: '',
    artifactType: 'SERVICE',
    schemaVersion: '1',
    digest: '',
  });
  const [manifest, setManifest] = useState({
    entrypoint: '',
    packageReference: '',
    changeSummary: '',
  });
  const [policy, setPolicy] = useState<ArtifactPolicyDraft>({
    currentVersion: '',
    targetVersion: '',
    migrationState: 'MANUAL_REVIEW',
    clients: [],
    dependencies: [],
    allowAdded: true,
    allowRemoved: false,
    allowIncreased: false,
    rollbackRequired: true,
    rollbackStrategy: 'MANUAL_RESTORE',
  });
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try {
      const version = Number(identity.schemaVersion);
      if (!Number.isInteger(version) || version < 1)
        throw new ArtifactFormError('MANIFEST_REQUIRED');
      const digest = identity.digest.trim();
      if (digest && !/^[0-9a-f]{64}$/.test(digest))
        throw new Error(t('artifactGovernance.validation.digest'));
      await onSubmit({
        productKey: identity.productKey.trim(),
        artifactVersion: identity.artifactVersion.trim(),
        artifactType: identity.artifactType,
        manifestSchemaVersion: version,
        manifest: buildArtifactManifest(manifest),
        compatibilityPolicy: buildCompatibilityPolicy(policy) as unknown as Record<string, never>,
        ...(digest ? { declaredDigest: digest } : {}),
      });
    } catch (caught) {
      setError(localizedError(caught, t));
    }
  };
  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('artifactGovernance.createManifestTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('artifactGovernance.createManifest')}
      busy={busy}
      submitDisabled={!identity.productKey.trim() || !identity.artifactVersion.trim()}
      onClose={onClose}
      onSubmit={submit}
    >
      <Stack gap={2}>
        <Alert severity="info">{t('artifactGovernance.manifestGuidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormField
            required
            label={t('artifactGovernance.fields.productKey')}
            value={identity.productKey}
            onChange={(event) => setIdentity({ ...identity, productKey: event.target.value })}
          />
          <FormField
            required
            label={t('artifactGovernance.fields.artifactVersion')}
            value={identity.artifactVersion}
            onChange={(event) => setIdentity({ ...identity, artifactVersion: event.target.value })}
          />
          <SelectField
            label={t('artifactGovernance.fields.artifactType')}
            value={identity.artifactType}
            options={ARTIFACT_TYPES.map((value) => ({
              value,
              label: t(`artifactGovernance.enums.artifactType.${value}`),
            }))}
            onValueChange={(artifactType) => setIdentity({ ...identity, artifactType })}
          />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormField
            required
            type="number"
            label={t('artifactGovernance.fields.schemaVersion')}
            value={identity.schemaVersion}
            onChange={(event) => setIdentity({ ...identity, schemaVersion: event.target.value })}
          />
          <FormField
            label={t('artifactGovernance.fields.digest')}
            value={identity.digest}
            onChange={(event) => setIdentity({ ...identity, digest: event.target.value })}
            supportingText={t('artifactGovernance.digestHelp')}
          />
        </Stack>
        <Divider />
        <Typography variant="subtitle2">{t('artifactGovernance.fields.manifest')}</Typography>
        <FormField
          required
          label={t('artifactGovernance.fields.entrypoint')}
          value={manifest.entrypoint}
          onChange={(event) => setManifest({ ...manifest, entrypoint: event.target.value })}
        />
        <FormField
          label={t('artifactGovernance.fields.packageReference')}
          value={manifest.packageReference}
          onChange={(event) => setManifest({ ...manifest, packageReference: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label={t('artifactGovernance.fields.changeSummary')}
          value={manifest.changeSummary}
          onChange={(event) => setManifest({ ...manifest, changeSummary: event.target.value })}
        />
        <Divider />
        <Typography variant="subtitle2">
          {t('artifactGovernance.fields.compatibilityPolicy')}
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormField
            required
            label={t('artifactGovernance.fields.currentVersion')}
            value={policy.currentVersion}
            onChange={(event) => setPolicy({ ...policy, currentVersion: event.target.value })}
          />
          <FormField
            required
            label={t('artifactGovernance.fields.targetVersion')}
            value={policy.targetVersion}
            onChange={(event) => setPolicy({ ...policy, targetVersion: event.target.value })}
          />
          <SelectField
            label={t('artifactGovernance.typed.migrationState')}
            value={policy.migrationState}
            options={['ADDITIVE_ONLY', 'DUAL_WRITE', 'MANUAL_REVIEW', 'UNAVAILABLE'].map(
              (value) => ({ value, label: t(`artifactGovernance.enums.migrationState.${value}`) })
            )}
            onValueChange={(migrationState) => setPolicy({ ...policy, migrationState })}
          />
        </Stack>
        <RequirementEditor
          label={t('artifactGovernance.typed.clientCompatibility')}
          keyLabel={t('artifactGovernance.fields.clientType')}
          values={policy.clients}
          onChange={(clients) => setPolicy({ ...policy, clients })}
        />
        <RequirementEditor
          label={t('artifactGovernance.typed.dependencies')}
          keyLabel={t('artifactGovernance.fields.dependencyKey')}
          values={policy.dependencies}
          onChange={(dependencies) => setPolicy({ ...policy, dependencies })}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          {(['allowAdded', 'allowRemoved', 'allowIncreased'] as const).map((key) => (
            <FormControlLabel
              key={key}
              control={
                <Switch
                  checked={policy[key]}
                  onChange={(event) => setPolicy({ ...policy, [key]: event.target.checked })}
                />
              }
              label={t(`artifactGovernance.fields.${key}`)}
            />
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={policy.rollbackRequired}
                onChange={(event) =>
                  setPolicy({ ...policy, rollbackRequired: event.target.checked })
                }
              />
            }
            label={t('artifactGovernance.fields.rollbackRequired')}
          />
          <SelectField
            label={t('artifactGovernance.typed.strategy')}
            value={policy.rollbackStrategy}
            options={['TRAFFIC_REVERT', 'CONFIG_REVERT', 'MANUAL_RESTORE', 'UNAVAILABLE'].map(
              (value) => ({ value, label: t(`artifactGovernance.enums.rollbackStrategy.${value}`) })
            )}
            onValueChange={(rollbackStrategy) => setPolicy({ ...policy, rollbackStrategy })}
          />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

export function CompatibilityDialog({
  artifact,
  busy,
  onClose,
  onSubmit,
}: {
  artifact: ProviderArtifactManifest;
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    request: Parameters<typeof assessProviderArtifactCompatibility>[1]
  ) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const template = compatibilityEvidenceTemplate(artifact.compatibilityPolicy);
  const [evidence, setEvidence] = useState<CompatibilityEvidence | null>(template);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try {
      if (!evidence) throw new ArtifactFormError('COMPATIBILITY_INVALID');
      const assessment = buildCompatibilityAssessment(artifact.compatibilityPolicy, evidence);
      await onSubmit({ ...assessment, reason: reason.trim() });
    } catch (caught) {
      setError(localizedError(caught, t));
    }
  };
  if (!evidence)
    return (
      <FormDialog
        open
        title={t('artifactGovernance.compatibilityTitle')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('artifactGovernance.recordCompatibility')}
        submitDisabled
        busy={false}
        onClose={onClose}
        onSubmit={submit}
      >
        <Alert severity="error">{t('artifactGovernance.validation.COMPATIBILITY_INVALID')}</Alert>
      </FormDialog>
    );
  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('artifactGovernance.compatibilityTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('artifactGovernance.recordCompatibility')}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
      onSubmit={submit}
    >
      <Stack gap={2}>
        <Alert severity="info">
          {t('artifactGovernance.compatibilityGuidance', {
            product: artifact.productKey,
            version: artifact.artifactVersion,
          })}
        </Alert>
        <Alert severity="warning">{t('artifactGovernance.typedEvidenceGuidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <SelectField
          label={t('artifactGovernance.typed.schemaCompatibility')}
          value={evidence.schema.state}
          options={COMPATIBILITY_STATES.map((value) => ({
            value,
            label: t(`artifactGovernance.enums.compatibilityState.${value}`),
          }))}
          onValueChange={(state) =>
            setEvidence({ ...evidence, schema: { ...evidence.schema, state } })
          }
        />
        {evidence.clients.map((client, index) => (
          <Stack key={client.clientType} direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <FormField
              disabled
              label={t('artifactGovernance.fields.clientType')}
              value={client.clientType}
            />
            <FormField
              disabled
              label={t('artifactGovernance.fields.requiredVersion')}
              value={client.minimumVersion}
            />
            <SelectField
              label={t('artifactGovernance.fields.compatibilityState')}
              value={client.state}
              options={COMPATIBILITY_STATES.map((value) => ({
                value,
                label: t(`artifactGovernance.enums.compatibilityState.${value}`),
              }))}
              onValueChange={(state) =>
                setEvidence({
                  ...evidence,
                  clients: evidence.clients.map((candidate, itemIndex) =>
                    itemIndex === index ? { ...candidate, state } : candidate
                  ),
                })
              }
            />
          </Stack>
        ))}
        {evidence.dependencies.map((dependency, index) => (
          <Stack key={dependency.dependencyKey} direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <FormField
              disabled
              label={t('artifactGovernance.fields.dependencyKey')}
              value={dependency.dependencyKey}
            />
            <FormField
              required
              label={t('artifactGovernance.fields.observedVersion')}
              value={dependency.observedVersion}
              onChange={(event) =>
                setEvidence({
                  ...evidence,
                  dependencies: evidence.dependencies.map((candidate, itemIndex) =>
                    itemIndex === index
                      ? { ...candidate, observedVersion: event.target.value }
                      : candidate
                  ),
                })
              }
            />
            <SelectField
              label={t('artifactGovernance.fields.compatibilityState')}
              value={dependency.state}
              options={COMPATIBILITY_STATES.map((value) => ({
                value,
                label: t(`artifactGovernance.enums.compatibilityState.${value}`),
              }))}
              onValueChange={(state) =>
                setEvidence({
                  ...evidence,
                  dependencies: evidence.dependencies.map((candidate, itemIndex) =>
                    itemIndex === index ? { ...candidate, state } : candidate
                  ),
                })
              }
            />
          </Stack>
        ))}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {(['added', 'removed', 'increased'] as const).map((key) => (
            <StringListEditor
              key={key}
              label={t(`artifactGovernance.typed.${key}`)}
              values={evidence.capabilities[key]}
              onChange={(values) =>
                setEvidence({
                  ...evidence,
                  capabilities: { ...evidence.capabilities, [key]: values },
                })
              }
            />
          ))}
        </Box>
        <SelectField
          label={t('artifactGovernance.typed.rollbackReadiness')}
          value={evidence.rollbackReadiness.state}
          options={['READY', 'REVIEW_REQUIRED', 'BLOCKED', 'UNAVAILABLE'].map((value) => ({
            value,
            label: t(`artifactGovernance.enums.rollbackState.${value}`),
          }))}
          onValueChange={(state) =>
            setEvidence({
              ...evidence,
              rollbackReadiness: { ...evidence.rollbackReadiness, state },
            })
          }
        />
        <StringListEditor
          label={t('artifactGovernance.fields.rollbackReasons')}
          values={evidence.rollbackReadiness.reasons}
          onChange={(reasons) =>
            setEvidence({
              ...evidence,
              rollbackReadiness: { ...evidence.rollbackReadiness, reasons },
            })
          }
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('artifactGovernance.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function ReviewDialog({
  artifact,
  decision,
  busy,
  onClose,
  onSubmit,
}: {
  artifact: ProviderArtifactManifest;
  decision: 'APPROVED' | 'RETURNED';
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: Parameters<typeof decideProviderArtifactManifest>[1]) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState({
    sourceReference: '',
    summary: '',
    checks: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open
      maxWidth="md"
      title={t(`artifactGovernance.review.${decision}.title`)}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(`artifactGovernance.review.${decision}.action`)}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await onSubmit({
            decision,
            reason: reason.trim(),
            evidence: buildArtifactEvidence(evidence),
          });
        } catch (caught) {
          setError(localizedError(caught, t));
        }
      }}
    >
      <Stack gap={2}>
        <Alert severity={decision === 'APPROVED' ? 'success' : 'warning'}>
          {t('artifactGovernance.reviewGuidance', {
            product: artifact.productKey,
            version: artifact.artifactVersion,
          })}
        </Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <EvidenceFields value={evidence} onChange={setEvidence} />
        <FormField
          required
          multiline
          minRows={3}
          label={t('artifactGovernance.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function PlanDialog({
  artifacts,
  busy,
  onClose,
  onSubmit,
}: {
  artifacts: ProviderArtifactManifest[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: Parameters<typeof createProviderArtifactRolloutPlan>[0]) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const eligible = artifacts.filter(
    (artifact) =>
      artifact.lifecycleState === 'APPROVED' && artifact.compatibilityState === 'COMPATIBLE'
  );
  const [artifactId, setArtifactId] = useState(eligible[0]?.artifactId ?? '');
  const [name, setName] = useState('');
  const [target, setTarget] = useState<ArtifactTargetDraft>({
    environmentKey: 'production',
    tenantKeys: [],
    cohortKeys: ['pilot'],
    targetPercentage: '10',
  });
  const [stages, setStages] = useState<ArtifactStageDraft[]>([
    {
      id: crypto.randomUUID(),
      stageKey: 'pilot',
      targetPercentage: '10',
      minimumObservationMinutes: '60',
      approvalGate: true,
    },
  ]);
  const [rollbackFeasibility, setRollbackFeasibility] = useState('UNAVAILABLE');
  const [rollback, setRollback] = useState<ArtifactRollbackDraft>({
    strategy: 'MANUAL_RESTORE',
    targetVersion: '',
    dataHandling: 'MANUAL_RECONCILIATION',
    validationChecks: ['service-health'],
    manualSteps: [],
  });
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try {
      await onSubmit({
        artifactId,
        name: name.trim(),
        targetScope: buildArtifactTarget(target),
        stages: buildArtifactStages(stages),
        rollbackFeasibility,
        ...(rollbackFeasibility === 'DECLARED'
          ? { rollbackPlan: buildArtifactRollback(rollback) }
          : {}),
        reason: reason.trim(),
      });
    } catch (caught) {
      setError(localizedError(caught, t));
    }
  };
  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('artifactGovernance.createPlanTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('artifactGovernance.createPlan')}
      busy={busy}
      submitDisabled={!artifactId || !name.trim() || !reason.trim()}
      onClose={onClose}
      onSubmit={submit}
    >
      <Stack gap={2}>
        <Alert severity="warning">{t('artifactGovernance.planGuidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        {!eligible.length && (
          <Alert severity="warning">{t('artifactGovernance.noEligibleArtifacts')}</Alert>
        )}
        <SelectField
          label={t('artifactGovernance.fields.artifact')}
          value={artifactId}
          options={eligible.map((artifact) => ({
            value: artifact.artifactId,
            label: `${artifact.productKey} · ${artifact.artifactVersion}`,
          }))}
          onValueChange={setArtifactId}
        />
        <FormField
          required
          label={t('artifactGovernance.fields.planName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Divider />
        <Typography variant="subtitle2">{t('artifactGovernance.typed.targetScope')}</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormField
            required
            label={t('artifactGovernance.typed.environment')}
            value={target.environmentKey}
            onChange={(event) => setTarget({ ...target, environmentKey: event.target.value })}
          />
          <FormField
            required
            type="number"
            label={t('artifactGovernance.typed.targetPercentage')}
            value={target.targetPercentage}
            onChange={(event) => setTarget({ ...target, targetPercentage: event.target.value })}
          />
        </Stack>
        <StringListEditor
          label={t('artifactGovernance.typed.tenants')}
          values={target.tenantKeys}
          onChange={(tenantKeys) => setTarget({ ...target, tenantKeys })}
        />
        <StringListEditor
          label={t('artifactGovernance.typed.cohorts')}
          values={target.cohortKeys}
          onChange={(cohortKeys) => setTarget({ ...target, cohortKeys })}
        />
        <Divider />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="subtitle2">{t('artifactGovernance.typed.rolloutStages')}</Typography>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Plus size={16} />}
            disabled={stages.length >= 20}
            onClick={() =>
              setStages([
                ...stages,
                {
                  id: crypto.randomUUID(),
                  stageKey: '',
                  targetPercentage: '',
                  minimumObservationMinutes: '60',
                  approvalGate: true,
                },
              ])
            }
          >
            {t('artifactGovernance.actions.addStage')}
          </ActionButton>
        </Stack>
        {stages.map((stage, index) => (
          <Box key={stage.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="subtitle2">
                {t('artifactGovernance.stageIndex', { index: index + 1 })}
              </Typography>
              <ActionButton
                intent="quiet"
                aria-label={t('artifactGovernance.actions.removeItem')}
                disabled={stages.length === 1}
                onClick={() => setStages(stages.filter((candidate) => candidate.id !== stage.id))}
              >
                <Trash2 size={16} />
              </ActionButton>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={1} sx={{ mt: 1 }}>
              <FormField
                required
                label={t('artifactGovernance.fields.stageKey')}
                value={stage.stageKey}
                onChange={(event) =>
                  setStages(
                    stages.map((candidate) =>
                      candidate.id === stage.id
                        ? { ...candidate, stageKey: event.target.value }
                        : candidate
                    )
                  )
                }
              />
              <FormField
                required
                type="number"
                label={t('artifactGovernance.typed.targetPercentage')}
                value={stage.targetPercentage}
                onChange={(event) =>
                  setStages(
                    stages.map((candidate) =>
                      candidate.id === stage.id
                        ? { ...candidate, targetPercentage: event.target.value }
                        : candidate
                    )
                  )
                }
              />
              <FormField
                required
                type="number"
                label={t('artifactGovernance.fields.observationMinutes')}
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
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={stage.approvalGate}
                  onChange={(event) =>
                    setStages(
                      stages.map((candidate) =>
                        candidate.id === stage.id
                          ? { ...candidate, approvalGate: event.target.checked }
                          : candidate
                      )
                    )
                  }
                />
              }
              label={t('artifactGovernance.typed.approvalRequired')}
            />
          </Box>
        ))}
        <SelectField
          label={t('artifactGovernance.fields.rollbackFeasibility')}
          value={rollbackFeasibility}
          options={ROLLBACK_STATES.map((value) => ({
            value,
            label: t(`artifactGovernance.rollback.${value}`),
          }))}
          onValueChange={setRollbackFeasibility}
        />
        {rollbackFeasibility === 'DECLARED' && (
          <Stack gap={2}>
            <SelectField
              label={t('artifactGovernance.typed.strategy')}
              value={rollback.strategy}
              options={['TRAFFIC_REVERT', 'CONFIG_REVERT', 'MANUAL_RESTORE'].map((value) => ({
                value,
                label: t(`artifactGovernance.enums.rollbackStrategy.${value}`),
              }))}
              onValueChange={(strategy) => setRollback({ ...rollback, strategy })}
            />
            <FormField
              required
              label={t('artifactGovernance.typed.targetVersion')}
              value={rollback.targetVersion}
              onChange={(event) => setRollback({ ...rollback, targetVersion: event.target.value })}
            />
            <SelectField
              label={t('artifactGovernance.typed.dataHandling')}
              value={rollback.dataHandling}
              options={['PRESERVE_CURRENT_SCHEMA', 'RESTORE_SNAPSHOT', 'MANUAL_RECONCILIATION'].map(
                (value) => ({ value, label: t(`artifactGovernance.enums.dataHandling.${value}`) })
              )}
              onValueChange={(dataHandling) => setRollback({ ...rollback, dataHandling })}
            />
            <StringListEditor
              label={t('artifactGovernance.typed.validationChecks')}
              values={rollback.validationChecks}
              onChange={(validationChecks) => setRollback({ ...rollback, validationChecks })}
            />
            <StringListEditor
              label={t('artifactGovernance.typed.manualSteps')}
              values={rollback.manualSteps}
              onChange={(manualSteps) => setRollback({ ...rollback, manualSteps })}
            />
          </Stack>
        )}
        <FormField
          required
          multiline
          minRows={3}
          label={t('artifactGovernance.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function EvidenceDialog({
  plan,
  busy,
  onClose,
  onSubmit,
}: {
  plan: ProviderArtifactRolloutPlan;
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    request: Parameters<typeof appendProviderArtifactRolloutEvidence>[1]
  ) => Promise<unknown>;
}) {
  const { t } = useTranslation('provider');
  const [type, setType] = useState<(typeof EVIDENCE_TYPES)[number]>('PRE_FLIGHT');
  const [state, setState] = useState<(typeof EVIDENCE_STATES)[number]>('INCONCLUSIVE');
  const [evidence, setEvidence] = useState({
    sourceReference: '',
    summary: '',
    checks: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const effectiveState = type === 'OBSERVATION' ? 'NOT_DISPATCHED' : state;
  const states =
    type === 'MANUAL_RECEIPT'
      ? EVIDENCE_STATES.filter((value) => value !== 'PASSED')
      : EVIDENCE_STATES;
  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('artifactGovernance.evidenceTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('artifactGovernance.recordEvidence')}
      busy={busy}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await onSubmit({
            evidenceType: type,
            evidenceState: effectiveState,
            evidence: buildArtifactEvidence(evidence),
          });
        } catch (caught) {
          setError(localizedError(caught, t));
        }
      }}
    >
      <Stack gap={2}>
        <Alert severity="info">
          {t('artifactGovernance.evidenceGuidance', { name: plan.name })}
        </Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <SelectField
          label={t('artifactGovernance.fields.evidenceType')}
          value={type}
          options={EVIDENCE_TYPES.map((value) => ({
            value,
            label: t(`artifactGovernance.evidenceTypes.${value}`),
          }))}
          onValueChange={(value) => {
            const next = value as (typeof EVIDENCE_TYPES)[number];
            setType(next);
            if (next === 'MANUAL_RECEIPT' && state === 'PASSED') setState('INCONCLUSIVE');
          }}
        />
        <SelectField
          disabled={type === 'OBSERVATION'}
          label={t('artifactGovernance.fields.evidenceState')}
          value={effectiveState}
          options={states.map((value) => ({
            value,
            label: t(`artifactGovernance.evidenceStates.${value}`),
          }))}
          onValueChange={(value) => setState(value as (typeof EVIDENCE_STATES)[number])}
        />
        <EvidenceFields value={evidence} onChange={setEvidence} />
      </Stack>
    </FormDialog>
  );
}
