import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';
import { DwaionTokenBudgetActivationNotice } from './dwaion-token-budget-activation';

export type DwaionCostSimulationDraft = {
  workloadVolume: string;
  averageInputTokens: string;
  averageOutputTokens: string;
  currentRoute: string;
  candidateRoute: string;
  qualityFloor: string;
  latencyLimitMs: string;
  costLimit: string;
  expectedEffect: string;
  risks: string;
};

export type DwaionBacklogDraft = {
  itemId: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  metricEvidence: string;
  state: 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'DONE';
  problemCluster: string;
  targetValue: string;
  linkedRelease: string;
  ownerTeam: string;
  version: number;
};

export type DwaionBudgetDraft = {
  scope: string;
  budgetTokens: string;
  policyMode: 'WARN' | 'THROTTLE' | 'BLOCK';
  enforcementActivationState: 'ENABLED' | 'DISABLED';
  version: number;
};

type DialogProps<T> = {
  value: T | null;
  onChange: (value: T | null) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function DwaionCostSimulationDialog({
  value,
  onChange,
  onClose,
  onSubmit,
}: DialogProps<DwaionCostSimulationDraft>) {
  const copy = useDwaionAdminAdvancementCopy();
  if (!value) return null;
  const valid =
    positiveNumber(value.workloadVolume) &&
    nonNegativeNumber(value.averageInputTokens) &&
    nonNegativeNumber(value.averageOutputTokens) &&
    Boolean(
      value.currentRoute.trim() &&
      value.candidateRoute.trim() &&
      nonNegativeNumber(value.qualityFloor) &&
      Number(value.qualityFloor) <= 100 &&
      positiveNumber(value.latencyLimitMs) &&
      positiveNumber(value.costLimit) &&
      value.expectedEffect.trim() &&
      value.risks.trim()
    );
  return (
    <FormDialog
      open
      title={copy.ui.outcomes.costSimulation}
      description={copy.ui.outcomes.costSimulationDescription}
      cancelLabel="Cancel"
      submitLabel="Review simulation"
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        <FormField
          required
          type="number"
          label={copy.ui.outcomes.workloadVolume}
          value={value.workloadVolume}
          onChange={(event) => onChange({ ...value, workloadVolume: event.target.value })}
        />
        <FormField
          required
          type="number"
          label={copy.ui.outcomes.averageInputTokens}
          value={value.averageInputTokens}
          onChange={(event) => onChange({ ...value, averageInputTokens: event.target.value })}
        />
        <FormField
          required
          type="number"
          label={copy.ui.outcomes.averageOutputTokens}
          value={value.averageOutputTokens}
          onChange={(event) => onChange({ ...value, averageOutputTokens: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.outcomes.currentRoute}
          value={value.currentRoute}
          onChange={(event) => onChange({ ...value, currentRoute: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.outcomes.candidateRoute}
          value={value.candidateRoute}
          onChange={(event) => onChange({ ...value, candidateRoute: event.target.value })}
        />
        <FormField
          required
          type="number"
          label={copy.ui.outcomes.qualityFloor}
          value={value.qualityFloor}
          onChange={(event) => onChange({ ...value, qualityFloor: event.target.value })}
        />
        <FormField
          required
          type="number"
          label={copy.ui.outcomes.latencyLimit}
          value={value.latencyLimitMs}
          onChange={(event) => onChange({ ...value, latencyLimitMs: event.target.value })}
        />
        <FormField
          required
          type="number"
          label={copy.ui.outcomes.costLimit}
          value={value.costLimit}
          onChange={(event) => onChange({ ...value, costLimit: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label={copy.ui.outcomes.expectedEffect}
          value={value.expectedEffect}
          onChange={(event) => onChange({ ...value, expectedEffect: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label={copy.ui.outcomes.risksAssumptions}
          value={value.risks}
          onChange={(event) => onChange({ ...value, risks: event.target.value })}
        />
      </Stack>
    </FormDialog>
  );
}

export function DwaionBacklogDialog({
  value,
  onChange,
  onClose,
  onSubmit,
}: DialogProps<DwaionBacklogDraft>) {
  const copy = useDwaionAdminAdvancementCopy();
  if (!value) return null;
  const valid = Boolean(
    value.title.trim() &&
    value.ownerTeam.trim() &&
    value.metricEvidence.trim() &&
    value.problemCluster.trim() &&
    value.targetValue.trim()
  );
  return (
    <FormDialog
      open
      title={copy.ui.outcomes.improvementBacklog}
      description={copy.ui.outcomes.improvementBacklogDescription}
      cancelLabel="Cancel"
      submitLabel="Review change"
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        <FormField
          required
          label={copy.ui.outcomes.title}
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.outcomes.ownerTeam}
          value={value.ownerTeam}
          onChange={(event) => onChange({ ...value, ownerTeam: event.target.value })}
        />
        <SelectField
          label={copy.ui.outcomes.priority}
          value={value.priority}
          options={(['P0', 'P1', 'P2', 'P3'] as const).map((priority) => ({
            value: priority,
            label: priority,
          }))}
          onValueChange={(priority) => priority && onChange({ ...value, priority })}
        />
        <FormField
          required
          label={copy.ui.outcomes.metricEvidence}
          value={value.metricEvidence}
          onChange={(event) => onChange({ ...value, metricEvidence: event.target.value })}
        />
        <SelectField
          label={copy.ui.outcomes.state}
          value={value.state}
          options={(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'DONE'] as const).map((state) => ({
            value: state,
            label: state,
          }))}
          onValueChange={(state) => state && onChange({ ...value, state })}
        />
        <FormField
          required
          label={copy.ui.outcomes.problemCluster}
          value={value.problemCluster}
          onChange={(event) => onChange({ ...value, problemCluster: event.target.value })}
        />
        <FormField
          required
          label={copy.ui.outcomes.targetValue}
          value={value.targetValue}
          onChange={(event) => onChange({ ...value, targetValue: event.target.value })}
        />
        <FormField
          label={copy.ui.outcomes.linkedRelease}
          value={value.linkedRelease}
          onChange={(event) => onChange({ ...value, linkedRelease: event.target.value })}
        />
      </Stack>
    </FormDialog>
  );
}

export function DwaionBudgetDialog({
  value,
  onChange,
  onClose,
  onSubmit,
}: DialogProps<DwaionBudgetDraft>) {
  const copy = useDwaionAdminAdvancementCopy();
  if (!value) return null;
  return (
    <FormDialog
      open
      title={copy.ui.outcomes.tokenBudgetPolicy}
      description={copy.ui.outcomes.tokenBudgetDescription}
      cancelLabel="Cancel"
      submitLabel="Review change"
      submitDisabled={!positiveNumber(value.budgetTokens)}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        <DwaionTokenBudgetActivationNotice
          activationState={value.enforcementActivationState}
          warning={copy.ui.outcomes.enforcementDisabledWarning}
          recovery={copy.ui.outcomes.enforcementDisabledRecovery}
        />
        <FormField label={copy.ui.outcomes.scope} value={value.scope} disabled />
        <FormField
          required
          type="number"
          label={copy.ui.outcomes.budgetTokens}
          value={value.budgetTokens}
          onChange={(event) => onChange({ ...value, budgetTokens: event.target.value })}
        />
        <SelectField
          label={copy.ui.outcomes.enforcement}
          value={value.policyMode}
          options={(['WARN', 'THROTTLE', 'BLOCK'] as const).map((mode) => ({
            value: mode,
            label: mode,
          }))}
          onValueChange={(policyMode) => policyMode && onChange({ ...value, policyMode })}
        />
      </Stack>
    </FormDialog>
  );
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function nonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}
