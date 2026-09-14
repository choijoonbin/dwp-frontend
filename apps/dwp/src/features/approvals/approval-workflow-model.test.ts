import { describe, expect, it } from 'vitest';

import {
  addApprovalWorkflowStep,
  approvalWorkflowDraftIssues,
  createApprovalWorkflowDraftSeed,
  duplicateApprovalWorkflowStep,
  isApprovalWorkflowDraftValid,
  moveApprovalWorkflowStep,
  removeApprovalWorkflowStep,
  updateApprovalWorkflowStep,
} from './approval-workflow-model';

describe('approval workflow model', () => {
  it('seeds one sequential ANY step without invented display content', () => {
    const draft = createApprovalWorkflowDraftSeed();

    expect(draft.steps).toEqual([
      {
        key: 'REVIEW_1',
        name: '',
        mode: 'ANY',
        candidateRole: 'APPROVAL_OPERATOR',
        slaMinutes: 1440,
      },
    ]);
  });

  it('adds, reorders, and removes steps immutably', () => {
    const first = createApprovalWorkflowDraftSeed();
    const second = addApprovalWorkflowStep(first);
    const moved = moveApprovalWorkflowStep(second, 1, -1);
    const removed = removeApprovalWorkflowStep(moved, 0);

    expect(first.steps).toHaveLength(1);
    expect(second.steps.map((step) => step.key)).toEqual(['REVIEW_1', 'REVIEW_2']);
    expect(moved.steps.map((step) => step.key)).toEqual(['REVIEW_2', 'REVIEW_1']);
    expect(removed.steps.map((step) => step.key)).toEqual(['REVIEW_1']);
  });

  it('never lets the editor promote a step to an unsupported quorum mode', () => {
    const draft = createApprovalWorkflowDraftSeed();
    const changed = updateApprovalWorkflowStep(draft, 0, {
      mode: 'ALL' as never,
      name: 'Review',
    });

    expect(changed.steps[0].mode).toBe('ANY');
  });

  it('blocks incomplete, duplicate, invalid SLA, and unsupported route definitions', () => {
    let draft = createApprovalWorkflowDraftSeed();
    draft = {
      ...draft,
      workflowKey: 'FLOW',
      nameKo: '결재선',
      nameEn: 'Approval route',
      descriptionKo: '설명',
      descriptionEn: 'Description',
      steps: [
        { ...draft.steps[0], name: 'Review' },
        {
          ...draft.steps[0],
          name: 'Review again',
          mode: 'ALL' as never,
          slaMinutes: 0,
        },
      ],
    };

    expect(approvalWorkflowDraftIssues(draft)).toEqual(
      expect.arrayContaining([
        { scope: 'step', field: 'stepKey', stepIndex: 1 },
        { scope: 'step', field: 'stepSlaMinutes', stepIndex: 1 },
        { scope: 'step', field: 'stepMode', stepIndex: 1 },
      ])
    );
    expect(isApprovalWorkflowDraftValid(draft)).toBe(false);
  });

  it('accepts a complete sequential ANY definition', () => {
    const seed = createApprovalWorkflowDraftSeed();
    const draft = {
      ...seed,
      workflowKey: 'FINANCE_REVIEW',
      nameKo: '재무 결재',
      nameEn: 'Finance review',
      descriptionKo: '재무 검토 결재선',
      descriptionEn: 'Finance review route',
      steps: [{ ...seed.steps[0], name: 'Manager review' }],
    };

    expect(approvalWorkflowDraftIssues(draft)).toEqual([]);
    expect(isApprovalWorkflowDraftValid(draft)).toBe(true);
  });
  it('duplicates a selected stage with a unique bounded key and preserves the source', () => {
    const draft = createApprovalWorkflowDraftSeed();
    const once = duplicateApprovalWorkflowStep(draft, 0);
    const twice = duplicateApprovalWorkflowStep(once, 0);
    expect(draft.steps).toHaveLength(1);
    expect(twice.steps.map((step) => step.key)).toEqual([
      'REVIEW_1',
      'REVIEW_1_COPY_2',
      'REVIEW_1_COPY_1',
    ]);
    const maximum = {
      ...draft,
      steps: Array.from({ length: 20 }, (_, index) => ({
        ...draft.steps[0],
        key: `REVIEW_${index}`,
      })),
    };
    expect(addApprovalWorkflowStep(maximum)).toBe(maximum);
    expect(duplicateApprovalWorkflowStep(maximum, 0)).toBe(maximum);
  });
  it('blocks excessive aggregate SLA, fractional minutes, and invalid candidate keys', () => {
    const seed = createApprovalWorkflowDraftSeed();
    const draft = {
      ...seed,
      slaMinutes: 30,
      steps: [
        { ...seed.steps[0], name: 'Review', candidateRole: 'invalid-role', slaMinutes: 30.5 },
      ],
    };
    expect(approvalWorkflowDraftIssues(draft)).toEqual(
      expect.arrayContaining([
        { scope: 'definition', field: 'slaMinutes' },
        { scope: 'step', field: 'stepSlaMinutes', stepIndex: 0 },
        { scope: 'step', field: 'candidateRole', stepIndex: 0 },
      ])
    );
  });
  it('rejects unknown category and classification instead of treating them as a ready definition', () => {
    expect(
      approvalWorkflowDraftIssues({
        ...createApprovalWorkflowDraftSeed(),
        category: 'UNKNOWN',
        dataClassification: 'UNKNOWN',
      })
    ).toEqual(
      expect.arrayContaining([
        { scope: 'definition', field: 'category' },
        { scope: 'definition', field: 'classification' },
      ])
    );
  });
});
