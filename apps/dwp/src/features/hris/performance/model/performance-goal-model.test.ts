import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  buildPerformanceGoalUpdate,
  classifyPerformanceGoalSaveFailure,
  createPerformanceGoalDraft,
  isPerformanceGoalEditable,
  rebasePerformanceGoalDraft,
  selectPerformancePersonalGoals,
  setPerformanceGoalDraftProgress,
  validatePerformanceGoalDraft,
  withPerformanceGoalSaveFailure,
} from './performance-goal-model';

import type { HrGoal, HrTalentWorkspace } from '@dwp-frontend/shared-utils';

const goal: HrGoal = {
  goalId: 'goal-1',
  title: 'Improve customer response time',
  goalType: 'PERSONAL',
  progressPercent: 40,
  dueDate: '2026-12-31',
  status: 'ACTIVE',
  version: 3,
};

const workspace: HrTalentWorkspace = {
  employee: {
    personId: 'person-1',
    displayName: 'Alex Kim',
    organizationName: 'People Experience',
    directReportCount: 0,
  },
  goals: [goal],
  journeys: [
    {
      journeyId: 'journey-1',
      name: 'Onboarding',
      journeyType: 'ONBOARDING',
      progressPercent: 80,
      status: 'ACTIVE',
    },
  ],
  learning: [
    {
      learningId: 'learning-1',
      title: 'Leadership course',
      required: false,
      progressPercent: 25,
      status: 'IN_PROGRESS',
    },
  ],
};

describe('performance goal draft contract', () => {
  it('updates progress without changing status when progress reaches 100%', () => {
    const draft = setPerformanceGoalDraftProgress(createPerformanceGoalDraft(goal), 100);

    expect(buildPerformanceGoalUpdate(draft)).toEqual({
      goalId: goal.goalId,
      request: {
        progressPercent: 100,
        status: 'ACTIVE',
        version: 3,
      },
    });
  });

  it('treats draft and unknown workflow states as read only', () => {
    expect(isPerformanceGoalEditable({ status: 'DRAFT' })).toBe(false);
    expect(isPerformanceGoalEditable({ status: 'IN_PROGRESS' })).toBe(false);
    expect(isPerformanceGoalEditable({ status: ' active ' })).toBe(true);
    expect(isPerformanceGoalEditable({ status: 'AT_RISK' })).toBe(true);
  });

  it('blocks non-editable, unchanged, forbidden, and stale drafts', () => {
    expect(validatePerformanceGoalDraft(createPerformanceGoalDraft(goal))).toBe('UNCHANGED');
    expect(
      validatePerformanceGoalDraft(createPerformanceGoalDraft({ ...goal, status: 'COMPLETED' }))
    ).toBe('NOT_EDITABLE');
    expect(
      validatePerformanceGoalDraft(
        withPerformanceGoalSaveFailure(
          setPerformanceGoalDraftProgress(createPerformanceGoalDraft(goal), 50),
          'FORBIDDEN'
        )
      )
    ).toBe('FORBIDDEN');
    expect(
      buildPerformanceGoalUpdate(
        withPerformanceGoalSaveFailure(
          setPerformanceGoalDraftProgress(createPerformanceGoalDraft(goal), 50),
          'CONFLICT'
        )
      )
    ).toBeNull();
  });

  it('rebases a conflict onto the latest version without discarding progress', () => {
    const desired = setPerformanceGoalDraftProgress(createPerformanceGoalDraft(goal), 100);
    const conflicted = withPerformanceGoalSaveFailure(desired, 'CONFLICT');
    const rebased = rebasePerformanceGoalDraft(conflicted, {
      ...goal,
      progressPercent: 60,
      version: 4,
    });

    expect(rebased).toMatchObject({
      baselineProgressPercent: 60,
      progressPercent: 100,
      version: 4,
      saveFailure: null,
    });
    expect(buildPerformanceGoalUpdate(rebased)?.request).toEqual({
      progressPercent: 100,
      status: 'ACTIVE',
      version: 4,
    });
  });

  it('locks a preserved draft when the latest goal is no longer editable', () => {
    const desired = setPerformanceGoalDraftProgress(createPerformanceGoalDraft(goal), 75);
    const rebased = rebasePerformanceGoalDraft(desired, {
      ...goal,
      status: 'CANCELLED',
      version: 5,
    });

    expect(rebased.progressPercent).toBe(75);
    expect(rebased.saveFailure).toBe('LOCKED');
    expect(validatePerformanceGoalDraft(rebased)).toBe('NOT_EDITABLE');
    expect(isPerformanceGoalEditable({ status: ' cancelled ' })).toBe(false);
  });
});

describe('performance goal failure and data-boundary contract', () => {
  it.each([
    [new HttpError('denied', 403), 'FORBIDDEN'],
    [new HttpError('missing', 404), 'NOT_FOUND'],
    [new HttpError('stale', 409), 'CONFLICT'],
    [new HttpError('busy', 503), 'UNAVAILABLE'],
    [new HttpTransportError('NETWORK'), 'UNAVAILABLE'],
    [new Error('unexpected'), 'UNKNOWN'],
  ] as const)('classifies %s as %s', (error, expected) => {
    expect(classifyPerformanceGoalSaveFailure(error)).toBe(expected);
  });

  it('selects only employee personal goals and reports unknown provenance honestly', () => {
    const selected = selectPerformancePersonalGoals(workspace);

    expect(selected.employee).toEqual({
      displayName: workspace.employee.displayName,
      organizationName: workspace.employee.organizationName,
    });
    expect(selected.employee).not.toBe(workspace.employee);
    expect(selected.goals).toEqual([goal]);
    expect(selected.provenance).toBe('UNKNOWN');
    expect(selected).not.toHaveProperty('journeys');
    expect(selected).not.toHaveProperty('learning');
  });

  it('supports declared and runtime reference-data provenance', () => {
    expect(selectPerformancePersonalGoals(workspace, 'SOURCE').provenance).toBe('SOURCE');
    expect(
      selectPerformancePersonalGoals({ ...workspace, referenceData: true } as HrTalentWorkspace)
        .provenance
    ).toBe('REFERENCE');
  });
});
describe('performance source privacy and strict payload boundary', () => {
  it.each([
    [
      'employee display object',
      {
        ...workspace,
        employee: { ...workspace.employee, displayName: { secret: 'synthetic-secret' } },
      },
    ],
    [
      'organization object',
      {
        ...workspace,
        employee: { ...workspace.employee, organizationName: { secret: 'synthetic-secret' } },
      },
    ],
    ['title object', { ...workspace, goals: [{ ...goal, title: { secret: 'synthetic-secret' } }] }],
    ['goal id whitespace', { ...workspace, goals: [{ ...goal, goalId: ' goal-1 ' }] }],
    ['NaN progress', { ...workspace, goals: [{ ...goal, progressPercent: NaN }] }],
    ['infinite progress', { ...workspace, goals: [{ ...goal, progressPercent: Infinity }] }],
    ['negative progress', { ...workspace, goals: [{ ...goal, progressPercent: -1 }] }],
    ['excess progress', { ...workspace, goals: [{ ...goal, progressPercent: 101 }] }],
    ['fractional version', { ...workspace, goals: [{ ...goal, version: 1.5 }] }],
    [
      'unsafe version',
      { ...workspace, goals: [{ ...goal, version: Number.MAX_SAFE_INTEGER + 1 }] },
    ],
    ['invalid civil date', { ...workspace, goals: [{ ...goal, dueDate: '2026-02-30' }] }],
    [
      'instant as due date',
      { ...workspace, goals: [{ ...goal, dueDate: '2026-12-31T00:00:00Z' }] },
    ],
    ['duplicate goal ids', { ...workspace, goals: [goal, { ...goal }] }],
    ['sparse goal array', { ...workspace, goals: new Array(1) }],
    ['string reference boolean', { ...workspace, referenceData: 'false' }],
    [
      'conflicting reference origin',
      { ...workspace, referenceData: false, dataOrigin: 'REFERENCE' },
    ],
    [
      'conflicting local seed origin',
      { ...workspace, referenceData: false, dataOrigin: 'LOCAL_SEED' },
    ],
  ] as const)('rejects malformed source %s without coercion or input echo', (_label, source) => {
    expect(() => selectPerformancePersonalGoals(source as never)).toThrow(
      'Performance source payload is invalid.'
    );
  });

  it('copies only allowed primitives and cannot retain adjacent-domain or source aliases', () => {
    const source = {
      ...workspace,
      employee: { ...workspace.employee, bankAccount: 'synthetic-private-bank' },
      goals: [{ ...goal, privateReview: { note: 'synthetic-private-review' } }],
    };
    const selected = selectPerformancePersonalGoals(source);
    expect(selected.employee).toEqual({
      displayName: workspace.employee.displayName,
      organizationName: workspace.employee.organizationName,
    });
    expect(selected.goals[0]).toEqual(goal);
    expect(selected.employee).not.toBe(source.employee);
    expect(selected.goals).not.toBe(source.goals);
    expect(selected.goals[0]).not.toBe(source.goals[0]);
    expect(JSON.stringify(selected)).not.toContain('synthetic-private');
    source.employee.displayName = 'Changed source employee';
    source.goals[0].title = 'Changed source goal';
    expect(selected.employee.displayName).toBe(workspace.employee.displayName);
    expect(selected.goals[0].title).toBe(goal.title);
    expect(Object.isFrozen(selected.employee)).toBe(true);
    expect(Object.isFrozen(selected.goals[0])).toBe(true);
  });

  it('cannot promote declared SOURCE over an observed REFERENCE payload', () => {
    expect(
      selectPerformancePersonalGoals({ ...workspace, referenceData: true } as never, 'SOURCE')
        .provenance
    ).toBe('REFERENCE');
  });
});
