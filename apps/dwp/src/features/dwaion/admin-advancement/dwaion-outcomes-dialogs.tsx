import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

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
      title="Cost simulation"
      description="Estimate a workload against a pinned route without changing production budgets."
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
          label="Workload volume"
          value={value.workloadVolume}
          onChange={(event) => onChange({ ...value, workloadVolume: event.target.value })}
        />
        <FormField
          required
          type="number"
          label="Average input tokens"
          value={value.averageInputTokens}
          onChange={(event) => onChange({ ...value, averageInputTokens: event.target.value })}
        />
        <FormField
          required
          type="number"
          label="Average output tokens"
          value={value.averageOutputTokens}
          onChange={(event) => onChange({ ...value, averageOutputTokens: event.target.value })}
        />
        <FormField
          required
          label="Current route"
          value={value.currentRoute}
          onChange={(event) => onChange({ ...value, currentRoute: event.target.value })}
        />
        <FormField
          required
          label="Candidate route"
          value={value.candidateRoute}
          onChange={(event) => onChange({ ...value, candidateRoute: event.target.value })}
        />
        <FormField
          required
          type="number"
          label="Quality floor (%)"
          value={value.qualityFloor}
          onChange={(event) => onChange({ ...value, qualityFloor: event.target.value })}
        />
        <FormField
          required
          type="number"
          label="Latency limit (ms)"
          value={value.latencyLimitMs}
          onChange={(event) => onChange({ ...value, latencyLimitMs: event.target.value })}
        />
        <FormField
          required
          type="number"
          label="Cost limit"
          value={value.costLimit}
          onChange={(event) => onChange({ ...value, costLimit: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label="Expected effect"
          value={value.expectedEffect}
          onChange={(event) => onChange({ ...value, expectedEffect: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label="Risks and assumptions"
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
      title="Improvement backlog"
      description="Tie the change to measured evidence, a target, an owner, and a release."
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
          label="Title"
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
        <FormField
          required
          label="Owner team"
          value={value.ownerTeam}
          onChange={(event) => onChange({ ...value, ownerTeam: event.target.value })}
        />
        <SelectField
          label="Priority"
          value={value.priority}
          options={(['P0', 'P1', 'P2', 'P3'] as const).map((priority) => ({
            value: priority,
            label: priority,
          }))}
          onValueChange={(priority) => priority && onChange({ ...value, priority })}
        />
        <FormField
          required
          label="Metric evidence"
          value={value.metricEvidence}
          onChange={(event) => onChange({ ...value, metricEvidence: event.target.value })}
        />
        <SelectField
          label="State"
          value={value.state}
          options={(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'DONE'] as const).map((state) => ({
            value: state,
            label: state,
          }))}
          onValueChange={(state) => state && onChange({ ...value, state })}
        />
        <FormField
          required
          label="Problem cluster"
          value={value.problemCluster}
          onChange={(event) => onChange({ ...value, problemCluster: event.target.value })}
        />
        <FormField
          required
          label="Target value"
          value={value.targetValue}
          onChange={(event) => onChange({ ...value, targetValue: event.target.value })}
        />
        <FormField
          label="Linked release"
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
  if (!value) return null;
  return (
    <FormDialog
      open
      title="Token budget policy"
      description="Review the scope, limit, enforcement mode, and recovery impact before approval."
      cancelLabel="Cancel"
      submitLabel="Review change"
      submitDisabled={!positiveNumber(value.budgetTokens)}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        <FormField label="Scope" value={value.scope} disabled />
        <FormField
          required
          type="number"
          label="Budget tokens"
          value={value.budgetTokens}
          onChange={(event) => onChange({ ...value, budgetTokens: event.target.value })}
        />
        <SelectField
          label="Enforcement"
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
