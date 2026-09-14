import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';

import { setApprovalTypedWorkflowPredecessors } from './approval-workflow-typed-editor-model';

import type {
  ApprovalTypedWorkflowDefinition,
  ApprovalTypedWorkflowQuorum,
  ApprovalTypedWorkflowStage,
} from './approval-workflow-typed-model';

export function ApprovalWorkflowTypedInspector({
  definition,
  stage,
  disabled,
  onRename,
  onUpdate,
  onQuorum,
  onPredecessors,
  onPendingChange,
}: {
  definition: ApprovalTypedWorkflowDefinition;
  stage: ApprovalTypedWorkflowStage;
  disabled: boolean;
  onRename: (key: string) => void;
  onUpdate: (
    patch: Partial<Pick<ApprovalTypedWorkflowStage, 'name' | 'candidateRole' | 'slaMinutes'>>
  ) => void;
  onQuorum: (quorum: ApprovalTypedWorkflowQuorum) => void;
  onPredecessors: (keys: readonly string[]) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { t } = useTranslation('approvals');
  const [key, setKey] = useState(stage.key);
  const [sla, setSla] = useState(String(stage.slaMinutes));
  const [threshold, setThreshold] = useState(
    'value' in stage.quorum ? String(stage.quorum.value) : '1'
  );
  useEffect(() => {
    setKey(stage.key);
    setSla(String(stage.slaMinutes));
    setThreshold('value' in stage.quorum ? String(stage.quorum.value) : '1');
  }, [stage.key, stage.slaMinutes, stage.quorum]);
  const thresholdPending = 'value' in stage.quorum && threshold !== String(stage.quorum.value);
  const pending =
    !disabled && (key !== stage.key || sla !== String(stage.slaMinutes) || thresholdPending);
  useEffect(() => {
    onPendingChange(pending);
    return () => onPendingChange(false);
  }, [onPendingChange, pending]);
  const modes = ['ANY', 'ALL', 'COUNT', 'PERCENT'] as const;
  return (
    <Stack gap={1.5}>
      <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
        {t('admin.studio.stepsSection')}
      </Box>
      <FormField
        size="small"
        label={t('admin.studio.stepKey')}
        disabled={disabled}
        value={key}
        inputProps={{ maxLength: 80 }}
        errorMessage={key !== stage.key ? t('admin.typedWorkflow.graphError') : undefined}
        onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
        onBlur={() => {
          if (/^[A-Z][A-Z0-9_]{1,79}$/.test(key)) onRename(key);
        }}
      />
      <FormField
        size="small"
        label={t('admin.studio.stepName')}
        disabled={disabled}
        value={stage.name}
        inputProps={{ maxLength: 120 }}
        onChange={(event) => onUpdate({ name: event.target.value })}
      />
      <FormField
        size="small"
        label={t('admin.studio.candidateRole')}
        disabled={disabled}
        value={stage.candidateRole}
        inputProps={{ maxLength: 50 }}
        onChange={(event) =>
          onUpdate({ candidateRole: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })
        }
      />
      <SelectField
        size="small"
        label={t('admin.studio.mode')}
        disabled={disabled}
        value={stage.quorum.mode}
        options={modes.map((mode) => ({
          value: mode,
          label: t(`admin.typedWorkflow.quorumModes.${mode}`),
        }))}
        onValueChange={(mode) => {
          if (mode === 'ANY' || mode === 'ALL') onQuorum({ mode });
          if (mode === 'COUNT' || mode === 'PERCENT') onQuorum({ mode, value: 1 });
        }}
      />
      {'value' in stage.quorum ? (
        <FormField
          size="small"
          type="number"
          label={t('admin.typedWorkflow.quorumValue')}
          value={threshold}
          disabled={disabled}
          inputProps={{ min: 1, max: stage.quorum.mode === 'PERCENT' ? 100 : 1000, step: 1 }}
          errorMessage={thresholdPending ? t('admin.typedWorkflow.graphError') : undefined}
          onChange={(event) => {
            const value = event.target.value;
            setThreshold(value);
            const count = Number(value);
            if (
              /^[1-9][0-9]*$/.test(value) &&
              Number.isSafeInteger(count) &&
              count <= (stage.quorum.mode === 'PERCENT' ? 100 : 1000) &&
              (stage.quorum.mode === 'COUNT' || stage.quorum.mode === 'PERCENT')
            )
              onQuorum({ mode: stage.quorum.mode, value: count });
          }}
        />
      ) : null}
      <FormField
        size="small"
        type="number"
        label={t('admin.studio.stepSla')}
        value={sla}
        disabled={disabled}
        inputProps={{ min: 15, max: 525600, step: 1 }}
        errorMessage={
          sla !== String(stage.slaMinutes) ? t('admin.typedWorkflow.graphError') : undefined
        }
        onChange={(event) => {
          const value = event.target.value;
          setSla(value);
          const minutes = Number(value);
          if (
            /^[1-9][0-9]*$/.test(value) &&
            Number.isSafeInteger(minutes) &&
            minutes >= 15 &&
            minutes <= 525600
          )
            onUpdate({ slaMinutes: minutes });
        }}
      />
      <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
        <Box component="legend" sx={{ typography: 'subtitle2', mb: 0.5 }}>
          {t('admin.typedWorkflow.predecessors')}
        </Box>
        <Stack>
          {definition.stages
            .filter((other) => other.key !== stage.key)
            .map((other) => {
              const checked = stage.predecessors.includes(other.key);
              const next = checked
                ? stage.predecessors.filter((keyValue) => keyValue !== other.key)
                : [...stage.predecessors, other.key];
              let invalid = false;
              try {
                setApprovalTypedWorkflowPredecessors(definition, stage.key, next);
              } catch {
                invalid = true;
              }
              return (
                <FormControlLabel
                  key={other.key}
                  sx={{
                    m: 0,
                    alignItems: 'start',
                    '& .MuiFormControlLabel-label': {
                      pt: 1,
                      overflowWrap: 'anywhere',
                      minWidth: 0,
                      typography: 'body2',
                    },
                  }}
                  label={`${other.name || other.key} · ${other.key}`}
                  control={
                    <Checkbox
                      size="small"
                      checked={checked}
                      disabled={disabled || invalid}
                      onChange={() => onPredecessors(next)}
                    />
                  }
                />
              );
            })}
          {!stage.predecessors.length ? (
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t('admin.typedWorkflow.noPredecessors')}
            </Box>
          ) : null}
        </Stack>
      </Box>
      <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
        {t('admin.typedWorkflow.rejectVeto')}
      </Box>
    </Stack>
  );
}
