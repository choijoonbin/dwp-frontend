import type { ApprovalWorkflowDraftInput, ApprovalWorkflowStep } from '@dwp-frontend/shared-utils';

export type ApprovalWorkflowDraft = ApprovalWorkflowDraftInput & { workflowKey: string };

export type ApprovalWorkflowDraftIssue = Readonly<{
  scope: 'definition' | 'step';
  field:
    | 'workflowKey'
    | 'nameKo'
    | 'nameEn'
    | 'descriptionKo'
    | 'descriptionEn'
    | 'ownerGroupRef'
    | 'category'
    | 'classification'
    | 'slaMinutes'
    | 'steps'
    | 'stepKey'
    | 'stepName'
    | 'candidateRole'
    | 'stepSlaMinutes'
    | 'stepMode';
  stepIndex?: number;
}>;

const baseStep = (ordinal: number, draft: ApprovalWorkflowDraft): ApprovalWorkflowStep => ({
  key: `REVIEW_${ordinal}`,
  name: '',
  mode: 'ANY',
  candidateRole: draft.ownerGroupRef || 'APPROVAL_OPERATOR',
  slaMinutes: draft.slaMinutes,
});

export function createApprovalWorkflowDraftSeed(): ApprovalWorkflowDraft {
  const draft: ApprovalWorkflowDraft = {
    workflowKey: '',
    nameKo: '',
    nameEn: '',
    descriptionKo: '',
    descriptionEn: '',
    category: 'GENERAL',
    dataClassification: 'INTERNAL',
    slaMinutes: 1440,
    ownerGroupRef: 'APPROVAL_OPERATOR',
    steps: [],
  };
  return { ...draft, steps: [baseStep(1, draft)] };
}

export function addApprovalWorkflowStep(draft: ApprovalWorkflowDraft): ApprovalWorkflowDraft {
  if (draft.steps.length >= 20) return draft;
  let ordinal = draft.steps.length + 1;
  while (draft.steps.some((step) => step.key === `REVIEW_${ordinal}`)) ordinal += 1;
  return { ...draft, steps: [...draft.steps, baseStep(ordinal, draft)] };
}

export function duplicateApprovalWorkflowStep(
  draft: ApprovalWorkflowDraft,
  index: number
): ApprovalWorkflowDraft {
  const source = draft.steps[index];
  if (!source || draft.steps.length >= 20) return draft;
  let ordinal = 1;
  const prefix = source.key.slice(0, 68) || 'REVIEW';
  while (draft.steps.some((step) => step.key === `${prefix}_COPY_${ordinal}`)) ordinal += 1;
  const steps = [...draft.steps];
  steps.splice(index + 1, 0, { ...source, key: `${prefix}_COPY_${ordinal}`, mode: 'ANY' });
  return { ...draft, steps };
}

export function updateApprovalWorkflowStep(
  draft: ApprovalWorkflowDraft,
  index: number,
  patch: Partial<ApprovalWorkflowStep>
): ApprovalWorkflowDraft {
  if (index < 0 || index >= draft.steps.length) return draft;
  return {
    ...draft,
    steps: draft.steps.map((step, stepIndex) =>
      stepIndex === index ? { ...step, ...patch, mode: 'ANY' } : step
    ),
  };
}

export function moveApprovalWorkflowStep(
  draft: ApprovalWorkflowDraft,
  index: number,
  direction: -1 | 1
): ApprovalWorkflowDraft {
  const target = index + direction;
  if (index < 0 || index >= draft.steps.length || target < 0 || target >= draft.steps.length) {
    return draft;
  }
  const steps = [...draft.steps];
  [steps[index], steps[target]] = [steps[target], steps[index]];
  return { ...draft, steps };
}

export function removeApprovalWorkflowStep(
  draft: ApprovalWorkflowDraft,
  index: number
): ApprovalWorkflowDraft {
  if (draft.steps.length <= 1 || index < 0 || index >= draft.steps.length) return draft;
  return { ...draft, steps: draft.steps.filter((_, stepIndex) => stepIndex !== index) };
}

export function approvalWorkflowDraftIssues(
  draft: ApprovalWorkflowDraft
): ApprovalWorkflowDraftIssue[] {
  return [
    ...approvalWorkflowMetadataIssues(draft),
    ...approvalWorkflowStepIssues(draft.steps, draft.slaMinutes),
  ];
}

export function approvalWorkflowMetadataIssues(
  draft: Omit<ApprovalWorkflowDraft, 'steps' | 'typedDefinition'>
): ApprovalWorkflowDraftIssue[] {
  const issues: ApprovalWorkflowDraftIssue[] = [];
  const definitionRequired: Array<[ApprovalWorkflowDraftIssue['field'], string, number]> = [
    ['workflowKey', draft.workflowKey, 3],
    ['nameKo', draft.nameKo, 1],
    ['nameEn', draft.nameEn, 1],
    ['descriptionKo', draft.descriptionKo, 1],
    ['descriptionEn', draft.descriptionEn, 1],
    ['ownerGroupRef', draft.ownerGroupRef, 1],
  ];
  for (const [field, value, minimum] of definitionRequired) {
    const maximum = field === 'ownerGroupRef' ? 160 : field.startsWith('description') ? 1000 : 200;
    if (value.trim().length < minimum || value.length > maximum) {
      issues.push({ scope: 'definition', field });
    }
  }
  if (!['FINANCE', 'PEOPLE', 'PROCUREMENT', 'ACCESS', 'GENERAL'].includes(draft.category)) {
    issues.push({ scope: 'definition', field: 'category' });
  }
  if (!['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(draft.dataClassification)) {
    issues.push({ scope: 'definition', field: 'classification' });
  }
  if (!Number.isInteger(draft.slaMinutes) || draft.slaMinutes < 15 || draft.slaMinutes > 525600) {
    issues.push({ scope: 'definition', field: 'slaMinutes' });
  }
  if (!/^[A-Z][A-Z0-9_]{2,99}$/u.test(draft.workflowKey)) {
    if (!issues.some((issue) => issue.field === 'workflowKey')) {
      issues.push({ scope: 'definition', field: 'workflowKey' });
    }
  }
  return issues;
}

export function approvalWorkflowStepIssues(
  steps: readonly ApprovalWorkflowStep[],
  overallSlaMinutes: number
): ApprovalWorkflowDraftIssue[] {
  const issues: ApprovalWorkflowDraftIssue[] = [];
  if (steps.length === 0 || steps.length > 20) {
    issues.push({ scope: 'definition', field: 'steps' });
  }
  if (steps.reduce((total, step) => total + step.slaMinutes, 0) > overallSlaMinutes) {
    issues.push({ scope: 'definition', field: 'slaMinutes' });
  }

  const normalizedKeys = new Set<string>();
  steps.forEach((step, stepIndex) => {
    const normalizedKey = step.key.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,79}$/u.test(step.key) || normalizedKeys.has(normalizedKey)) {
      issues.push({ scope: 'step', field: 'stepKey', stepIndex });
    }
    normalizedKeys.add(normalizedKey);
    if (!step.name.trim() || step.name.length > 200) {
      issues.push({ scope: 'step', field: 'stepName', stepIndex });
    }
    if (!/^[A-Z][A-Z0-9_]{1,79}$/u.test(step.candidateRole)) {
      issues.push({ scope: 'step', field: 'candidateRole', stepIndex });
    }
    if (!Number.isInteger(step.slaMinutes) || step.slaMinutes < 15 || step.slaMinutes > 525600) {
      issues.push({ scope: 'step', field: 'stepSlaMinutes', stepIndex });
    }
    if (step.mode !== 'ANY') issues.push({ scope: 'step', field: 'stepMode', stepIndex });
  });
  return issues;
}

export function isApprovalWorkflowDraftValid(draft: ApprovalWorkflowDraft): boolean {
  return approvalWorkflowDraftIssues(draft).length === 0;
}
