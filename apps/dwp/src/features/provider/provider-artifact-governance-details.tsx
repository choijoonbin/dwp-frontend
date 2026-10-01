import { useTranslation } from 'react-i18next';
import { ArrowRight, RotateCcw, Route, ShieldCheck } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  ProviderArtifactManifest,
  ProviderArtifactRolloutPlan,
} from '@dwp-frontend/shared-utils';

import {
  artifactEnumPresentation,
  parseRolloutProjection,
  type ArtifactEnumKind,
} from './provider-artifact-governance-model';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="div"
        variant="body2"
        fontWeight={650}
        sx={{ mt: 0.25, wordBreak: 'break-word' }}
      >
        {value || '-'}
      </Typography>
    </Box>
  );
}

function ListValue({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length)
    return (
      <Typography variant="body2" color="text.secondary">
        {empty}
      </Typography>
    );
  return (
    <Stack direction="row" gap={0.75} flexWrap="wrap">
      {values.map((value) => (
        <Chip key={value} size="small" variant="outlined" label={value} />
      ))}
    </Stack>
  );
}

function DetailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 0, height: '100%' }}>
      <Stack direction="row" gap={0.75} alignItems="center">
        {icon}
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Divider sx={{ my: 1.25 }} />
      {children}
    </Paper>
  );
}

function useArtifactEnumLabel() {
  const { t } = useTranslation('provider');
  return (kind: ArtifactEnumKind, value: string) => {
    const safeValue = artifactEnumPresentation(kind, value);
    return safeValue === 'UNAVAILABLE_VALUE'
      ? t('artifactGovernance.enums.unavailable')
      : t(`artifactGovernance.enums.${kind}.${safeValue}`);
  };
}

function ArtifactStateChip({ kind, state }: { kind: ArtifactEnumKind; state: string }) {
  const enumLabel = useArtifactEnumLabel();
  const safeState = artifactEnumPresentation(kind, state);
  const color = ['PASSED', 'READY', 'INTERNALLY_READY'].includes(safeState)
    ? 'success'
    : ['FAILED', 'BLOCKED'].includes(safeState)
      ? 'error'
      : 'warning';
  return <Chip size="small" variant="outlined" color={color} label={enumLabel(kind, state)} />;
}

export function ArtifactCompatibilityDetails({ artifact }: { artifact: ProviderArtifactManifest }) {
  const { t } = useTranslation('provider');
  const enumLabel = useArtifactEnumLabel();
  const { schema, clients, dependencies, capabilities, rollbackReadiness } = artifact.compatibility;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" fontWeight={750} sx={{ mb: 1 }}>
        {t('artifactGovernance.typed.compatibilityOverview')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.25,
        }}
      >
        <DetailCard
          title={t('artifactGovernance.typed.schemaCompatibility')}
          icon={<ShieldCheck size={17} />}
        >
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="body2" fontWeight={750}>
              {schema.currentVersion}
            </Typography>
            <ArrowRight size={15} />
            <Typography variant="body2" fontWeight={750}>
              {schema.targetVersion}
            </Typography>
            <ArtifactStateChip kind="compatibilityState" state={schema.state} />
          </Stack>
          <Box sx={{ mt: 1.25 }}>
            <Fact
              label={t('artifactGovernance.typed.migrationState')}
              value={enumLabel('migrationState', schema.migrationState)}
            />
          </Box>
        </DetailCard>
        <DetailCard
          title={t('artifactGovernance.typed.rollbackReadiness')}
          icon={<RotateCcw size={17} />}
        >
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <ArtifactStateChip kind="rollbackState" state={rollbackReadiness.state} />
            <Chip
              size="small"
              variant="outlined"
              label={enumLabel('executionBoundary', rollbackReadiness.executionBoundary)}
            />
          </Stack>
          <Box sx={{ mt: 1.25 }}>
            <Typography variant="body2" color="text.secondary">
              {rollbackReadiness.reasons.length
                ? t('artifactGovernance.typed.blockingReasons', {
                    count: rollbackReadiness.reasons.length,
                  })
                : t('artifactGovernance.typed.noBlockingReasons')}
            </Typography>
          </Box>
        </DetailCard>
        <DetailCard
          title={t('artifactGovernance.typed.clientCompatibility')}
          icon={<Route size={17} />}
        >
          <Stack gap={1}>
            {clients.map((client) => (
              <Stack
                key={`${client.clientType}:${client.minimumVersion}`}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
              >
                <Box minWidth={0}>
                  <Typography variant="body2" fontWeight={650}>
                    {client.clientType}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('artifactGovernance.typed.minimumVersion', {
                      version: client.minimumVersion,
                    })}
                  </Typography>
                </Box>
                <ArtifactStateChip kind="compatibilityState" state={client.state} />
              </Stack>
            ))}
            {!clients.length && (
              <Typography variant="body2" color="text.secondary">
                {t('artifactGovernance.typed.noneDeclared')}
              </Typography>
            )}
          </Stack>
        </DetailCard>
        <DetailCard title={t('artifactGovernance.typed.dependencies')} icon={<Route size={17} />}>
          <Stack gap={1}>
            {dependencies.map((dependency) => (
              <Stack
                key={dependency.dependencyKey}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
              >
                <Box minWidth={0}>
                  <Typography variant="body2" fontWeight={650}>
                    {dependency.dependencyKey}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('artifactGovernance.typed.requiredObserved', {
                      required: dependency.requiredVersion,
                      observed: dependency.observedVersion,
                    })}
                  </Typography>
                </Box>
                <ArtifactStateChip kind="compatibilityState" state={dependency.state} />
              </Stack>
            ))}
            {!dependencies.length && (
              <Typography variant="body2" color="text.secondary">
                {t('artifactGovernance.typed.noneDeclared')}
              </Typography>
            )}
          </Stack>
        </DetailCard>
      </Box>
      <Paper variant="outlined" sx={{ p: 1.5, mt: 1.25 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('artifactGovernance.typed.capabilityDelta')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          <Fact
            label={t('artifactGovernance.typed.added')}
            value={
              <ListValue values={capabilities.added} empty={t('artifactGovernance.typed.none')} />
            }
          />
          <Fact
            label={t('artifactGovernance.typed.removed')}
            value={
              <ListValue values={capabilities.removed} empty={t('artifactGovernance.typed.none')} />
            }
          />
          <Fact
            label={t('artifactGovernance.typed.increased')}
            value={
              <ListValue
                values={capabilities.increased}
                empty={t('artifactGovernance.typed.none')}
              />
            }
          />
        </Box>
      </Paper>
    </Box>
  );
}

export function ArtifactRolloutDetails({ plan }: { plan: ProviderArtifactRolloutPlan }) {
  const { t } = useTranslation('provider');
  const enumLabel = useArtifactEnumLabel();
  const projection = parseRolloutProjection(plan.targetScope, plan.stages, plan.rollbackPlan);

  return (
    <Box sx={{ mt: 2 }}>
      <Alert severity="info" sx={{ mb: 1.25 }}>
        {t('artifactGovernance.typed.internalPlanBoundary')}
      </Alert>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.8fr) minmax(0, 1.2fr)' },
          gap: 1.25,
        }}
      >
        <DetailCard title={t('artifactGovernance.typed.targetScope')} icon={<Route size={17} />}>
          {projection.target ? (
            <Stack gap={1.25}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 1,
                }}
              >
                <Fact
                  label={t('artifactGovernance.typed.environment')}
                  value={projection.target.environmentKey}
                />
                <Fact
                  label={t('artifactGovernance.typed.targetPercentage')}
                  value={`${projection.target.targetPercentage}%`}
                />
              </Box>
              <Fact
                label={t('artifactGovernance.typed.tenants')}
                value={
                  <ListValue
                    values={projection.target.tenantKeys}
                    empty={t('artifactGovernance.typed.allEligible')}
                  />
                }
              />
              <Fact
                label={t('artifactGovernance.typed.cohorts')}
                value={
                  <ListValue
                    values={projection.target.cohortKeys}
                    empty={t('artifactGovernance.typed.none')}
                  />
                }
              />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('artifactGovernance.typed.invalidProjection')}
            </Typography>
          )}
        </DetailCard>
        <DetailCard title={t('artifactGovernance.typed.rolloutStages')} icon={<Route size={17} />}>
          <Stack gap={1}>
            {projection.stages.map((stage, index) => (
              <Box key={`${stage.stageKey}:${index}`}>
                {index > 0 && <Divider sx={{ mb: 1 }} />}
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="body2" fontWeight={700}>
                    {stage.stageKey}
                  </Typography>
                  <Chip size="small" variant="outlined" label={`${stage.targetPercentage}%`} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('artifactGovernance.typed.stageConditions', {
                    minutes: stage.minimumObservationMinutes,
                    gate: stage.approvalGate
                      ? t('artifactGovernance.typed.approvalRequired')
                      : t('artifactGovernance.typed.noApprovalGate'),
                  })}
                </Typography>
              </Box>
            ))}
            {!projection.stages.length && (
              <Typography variant="body2" color="text.secondary">
                {t('artifactGovernance.typed.invalidProjection')}
              </Typography>
            )}
          </Stack>
        </DetailCard>
      </Box>
      <Paper variant="outlined" sx={{ p: 1.5, mt: 1.25 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1}
        >
          <Stack direction="row" gap={0.75} alignItems="center">
            <RotateCcw size={17} />
            <Typography variant="subtitle2">
              {t('artifactGovernance.typed.recoveryPlan')}
            </Typography>
          </Stack>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <ArtifactStateChip kind="rollbackState" state={plan.rollbackReadiness.state} />
            <Chip
              size="small"
              variant="outlined"
              label={enumLabel('rollbackFeasibility', plan.rollbackFeasibility)}
            />
          </Stack>
        </Stack>
        {projection.rollback ? (
          <Box
            sx={{
              mt: 1.25,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            <Fact
              label={t('artifactGovernance.typed.strategy')}
              value={enumLabel('rollbackStrategy', projection.rollback.strategy)}
            />
            <Fact
              label={t('artifactGovernance.typed.targetVersion')}
              value={projection.rollback.targetVersion}
            />
            <Fact
              label={t('artifactGovernance.typed.dataHandling')}
              value={enumLabel('dataHandling', projection.rollback.dataHandling)}
            />
            <Fact
              label={t('artifactGovernance.typed.validationChecks')}
              value={
                <ListValue
                  values={projection.rollback.validationChecks}
                  empty={t('artifactGovernance.typed.none')}
                />
              }
            />
            <Fact
              label={t('artifactGovernance.typed.manualSteps')}
              value={
                <ListValue
                  values={projection.rollback.manualSteps}
                  empty={t('artifactGovernance.typed.none')}
                />
              }
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {t('artifactGovernance.typed.noRollbackDeclared')}
          </Typography>
        )}
        {!!plan.rollbackReadiness.reasons.length && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1.25 }}>
            {t('artifactGovernance.typed.blockingReasons', {
              count: plan.rollbackReadiness.reasons.length,
            })}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
