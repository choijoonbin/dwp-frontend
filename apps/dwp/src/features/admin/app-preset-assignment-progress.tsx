import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleDashed, ShieldAlert } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  resolvePresetAssignmentProgress,
  type PresetAssignmentActorStage,
} from './app-preset-assignment-progress-model';

import type { AppAdminPresetAssignment } from '@dwp-frontend/shared-utils';

function actorStageColor(state: PresetAssignmentActorStage['state']) {
  if (state === 'RECORDED') return 'success' as const;
  if (state === 'PENDING') return 'warning' as const;
  return 'default' as const;
}

function ActorStage({ stage }: { stage: PresetAssignmentActorStage }) {
  const { t } = useTranslation('admin');
  const Icon = stage.state === 'RECORDED' ? CheckCircle2 : CircleDashed;
  const actor =
    stage.actorName ??
    (stage.actorId != null
      ? t('appGovernance.presets.progress.actorId', { id: stage.actorId })
      : t('appGovernance.presets.progress.actorNotRecorded'));

  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0 }}>
      <Stack direction="row" gap={1} alignItems="flex-start">
        <Icon size={18} aria-hidden="true" />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">
              {t(`appGovernance.presets.progress.roles.${stage.role}`)}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color={actorStageColor(stage.state)}
              label={t(`appGovernance.presets.progress.stageStates.${stage.state}`)}
            />
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {actor}
          </Typography>
          {stage.recordedAt && (
            <Typography variant="caption" color="text.secondary">
              {formatDate(stage.recordedAt, { dateStyle: 'medium', timeStyle: 'short' })}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function AppPresetAssignmentProgress({
  assignment,
}: {
  assignment: AppAdminPresetAssignment;
}) {
  const { t } = useTranslation('admin');
  const progress = resolvePresetAssignmentProgress(assignment);
  const separationSeverity =
    progress.separation === 'COMPLETE'
      ? ('success' as const)
      : progress.separation === 'VIOLATION'
        ? ('error' as const)
        : ('info' as const);

  return (
    <Box
      component="section"
      aria-labelledby="app-preset-progress-title"
      data-testid="app-preset-assignment-progress"
      sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
        <Box>
          <Typography id="app-preset-progress-title" component="h3" variant="h6">
            {t('appGovernance.presets.progress.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('appGovernance.presets.progress.description')}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={
            assignment.lifecycleState === 'ACTIVE'
              ? 'success'
              : assignment.lifecycleState === 'PENDING_APPROVAL'
                ? 'warning'
                : 'info'
          }
          label={t(`appGovernance.states.${assignment.lifecycleState}`)}
        />
      </Stack>

      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.25,
        }}
      >
        <Fact
          label={t('appGovernance.presets.progress.target')}
          value={`${assignment.principalName} · ${assignment.principalType}:${assignment.principalRef}`}
        />
        <Fact
          label={t('appGovernance.presets.progress.package')}
          value={`${assignment.presetName} · ${assignment.presetCode} v${assignment.catalogVersion}`}
        />
        <Fact
          label={t('appGovernance.presets.progress.scope')}
          value={`${assignment.resourceSetName} · ${assignment.resourceSetKey}`}
        />
        <Fact
          label={t('appGovernance.presets.progress.channel')}
          value={assignment.requestChannel}
        />
        <Fact
          label={t('appGovernance.presets.progress.validTo')}
          value={formatDate(assignment.validTo, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        <Fact
          label={t('appGovernance.presets.progress.reviewDue')}
          value={formatDate(assignment.reviewDueAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        <Fact
          label={t('appGovernance.presets.progress.duties')}
          value={
            assignment.duties.map((duty) => duty.dutyCode).join(', ') ||
            t('appGovernance.presets.progress.noDuties')
          }
        />
        <Fact
          label={t('appGovernance.presets.progress.justification')}
          value={assignment.justification}
        />
      </Box>

      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {progress.stages.map((stage) => (
          <ActorStage key={stage.role} stage={stage} />
        ))}
      </Box>

      <Alert
        severity={separationSeverity}
        icon={<ShieldAlert size={20} aria-hidden="true" />}
        sx={{ mt: 1.5 }}
      >
        {t(`appGovernance.presets.progress.separation.${progress.separation}`)}
      </Alert>

      {(assignment.decisionReason || assignment.activationReason) && (
        <Stack gap={0.75} sx={{ mt: 1.5 }}>
          {assignment.decisionReason && (
            <Fact
              label={t('appGovernance.presets.progress.decisionReason')}
              value={assignment.decisionReason}
            />
          )}
          {assignment.activationReason && (
            <Fact
              label={t('appGovernance.presets.progress.activationReason')}
              value={assignment.activationReason}
            />
          )}
        </Stack>
      )}
    </Box>
  );
}
