import { useTranslation } from 'react-i18next';
import { FormField, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import type { ApprovalWorkflowStep } from '@dwp-frontend/shared-utils';

export function ApprovalWorkflowStageInspector({
  step,
  index,
  disabled,
  onChange,
}: {
  step: ApprovalWorkflowStep;
  index: number;
  disabled: boolean;
  onChange: (patch: Partial<ApprovalWorkflowStep>) => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Stack gap={1.5}>
      <Stack direction="row" gap={1} alignItems="center">
        <Chip size="small" label={String(index + 1).padStart(2, '0')} />
        <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
          {t('admin.studio.stepsSection')}
        </Box>
      </Stack>
      <FormField
        size="small"
        label={t('admin.studio.stepKey')}
        value={step.key}
        disabled={disabled}
        inputProps={{ maxLength: 80 }}
        onChange={(event) =>
          onChange({ key: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })
        }
      />
      <FormField
        size="small"
        label={t('admin.studio.stepName')}
        value={step.name}
        disabled={disabled}
        inputProps={{ maxLength: 200 }}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <SelectField
        size="small"
        label={t('admin.studio.mode')}
        value={step.mode}
        disabled={disabled}
        options={[{ value: 'ANY', label: 'ANY' }]}
        supportingText={t('admin.studio.modeHelp')}
        onValueChange={(value) => value === 'ANY' && onChange({ mode: value })}
      />
      <FormField
        size="small"
        label={t('admin.studio.candidateRole')}
        value={step.candidateRole}
        disabled={disabled}
        inputProps={{ maxLength: 80 }}
        onChange={(event) => onChange({ candidateRole: event.target.value.toUpperCase() })}
      />
      <FormField
        size="small"
        type="number"
        label={t('admin.studio.stepSla')}
        value={step.slaMinutes}
        disabled={disabled}
        inputProps={{ min: 15, max: 525600, step: 1 }}
        onChange={(event) => onChange({ slaMinutes: Number(event.target.value) })}
      />
    </Stack>
  );
}
