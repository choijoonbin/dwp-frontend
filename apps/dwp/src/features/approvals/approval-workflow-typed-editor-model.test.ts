import { describe, expect, it } from 'vitest';

import {
  compileApprovalTypedWorkflow,
  validateApprovalTypedWorkflow,
} from './approval-workflow-typed-compiler';
import {
  addApprovalTypedWorkflowStage,
  createApprovalTypedWorkflowSeed,
  duplicateApprovalTypedWorkflowStage,
  moveApprovalTypedWorkflowStage,
  removeApprovalTypedWorkflowStage,
  renameApprovalTypedWorkflowStage,
  setApprovalTypedWorkflowPredecessors,
  setApprovalTypedWorkflowQuorum,
  setApprovalTypedWorkflowCondition,
  setApprovalTypedWorkflowSla,
  updateApprovalTypedWorkflowStage,
} from './approval-workflow-typed-editor-model';
import {
  APPROVAL_TYPED_WORKFLOW_CONTRACT,
  ApprovalTypedWorkflowError,
} from './approval-workflow-typed-model';

function definition() {
  return validateApprovalTypedWorkflow({
    schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT,
    schemaVersion: 2,
    slaMinutes: 60,
    stages: [
      {
        key: 'FINANCE_REVIEW',
        name: 'Finance',
        candidateRole: 'FINANCE_REVIEWER',
        quorum: { mode: 'COUNT', value: 2 },
        slaMinutes: 30,
        predecessors: [],
        routeCondition: { all: [{ field: 'amount', operator: 'IN', value: ['10', '20'] }] },
      },
      {
        key: 'SECURITY_REVIEW',
        name: 'Security',
        candidateRole: 'SECURITY_REVIEWER',
        quorum: { mode: 'ALL' },
        slaMinutes: 45,
        predecessors: [],
      },
      {
        key: 'FINAL_REVIEW',
        name: 'Final',
        candidateRole: 'APPROVAL_OPERATOR',
        quorum: { mode: 'ANY' },
        slaMinutes: 15,
        predecessors: ['FINANCE_REVIEW', 'SECURITY_REVIEW'],
      },
    ],
  });
}

describe('pure typed workflow editor mutations preserve real DAG and source semantics', () => {
  it('does not invent a role or source identity when creating an incomplete draft', () => {
    const draft = createApprovalTypedWorkflowSeed();
    expect(draft.stages[0].candidateRole).toBe('');
    expect(draft.stages[0].name).toBe('');
    expect(() => validateApprovalTypedWorkflow(draft)).toThrow(ApprovalTypedWorkflowError);
    expect(createApprovalTypedWorkflowSeed('FINANCE_REVIEWER').stages[0].candidateRole).toBe(
      'FINANCE_REVIEWER'
    );
    expect(() => createApprovalTypedWorkflowSeed('R'.repeat(51))).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it('serial/parallel are explicit graph actions, never stored as mode enums', () => {
    const source = definition();
    const serial = addApprovalTypedWorkflowStage(
      source,
      'FINANCE_REVIEWER',
      'SERIAL',
      'FINANCE_REVIEW'
    );
    expect(serial.stages.at(-1)?.predecessors).toEqual(['FINANCE_REVIEW']);
    const parallel = addApprovalTypedWorkflowStage(
      source,
      'FINANCE_REVIEWER',
      'PARALLEL',
      'FINAL_REVIEW'
    );
    expect(parallel.stages.at(-1)?.predecessors).toEqual(['FINANCE_REVIEW', 'SECURITY_REVIEW']);
    expect(parallel.stages.at(-1)?.quorum).toEqual({ mode: 'ANY' });
    expect(parallel.stages.at(-1)).not.toHaveProperty('mode');
    expect(parallel.stages.at(-1)).not.toHaveProperty('sourceId');
    expect(source.stages).toHaveLength(3);
    expect(() => addApprovalTypedWorkflowStage(source, 'FINANCE_REVIEWER', 'SERIAL')).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it('copies quorum and condition into a fresh deterministic key without rewiring successors', () => {
    const source = definition();
    const copied = duplicateApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW');
    expect(copied.stages[1].key).toBe('FINANCE_REVIEW_COPY_1');
    expect(copied.stages[1].quorum).toEqual({ mode: 'COUNT', value: 2 });
    expect(copied.stages[1].routeCondition).toEqual(source.stages[0].routeCondition);
    expect(copied.stages[1].routeCondition).not.toBe(source.stages[0].routeCondition);
    expect(Object.isFrozen(copied.stages[1].routeCondition?.all[0].value)).toBe(true);
    expect(copied.stages[3].predecessors).toEqual(['FINANCE_REVIEW', 'SECURITY_REVIEW']);
    const twice = duplicateApprovalTypedWorkflowStage(copied, 'FINANCE_REVIEW');
    expect(twice.stages[1].key).toBe('FINANCE_REVIEW_COPY_2');
  });

  it('keeps copied long keys within the Java bound and respects max64', () => {
    const source = renameApprovalTypedWorkflowStage(definition(), 'FINANCE_REVIEW', 'R'.repeat(80));
    const copy = duplicateApprovalTypedWorkflowStage(source, 'R'.repeat(80));
    expect(copy.stages[1].key.length).toBeLessThanOrEqual(80);
    let many = definition();
    for (let count = many.stages.length; count < 64; count++)
      many = duplicateApprovalTypedWorkflowStage(many, 'FINANCE_REVIEW');
    expect(many.stages).toHaveLength(64);
    expect(() => duplicateApprovalTypedWorkflowStage(many, 'FINANCE_REVIEW')).toThrow(
      ApprovalTypedWorkflowError
    );
    expect(() => addApprovalTypedWorkflowStage(many, 'FINANCE_REVIEWER', 'PARALLEL')).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it('renames every predecessor atomically but never rebinds a condition field', () => {
    const source = definition();
    const renamed = renameApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', 'NEW_FINANCE');
    expect(renamed.stages[0].key).toBe('NEW_FINANCE');
    expect(renamed.stages[2].predecessors).toEqual(['NEW_FINANCE', 'SECURITY_REVIEW']);
    expect(renamed.stages[0].routeCondition?.all[0].field).toBe('amount');
    expect(source.stages[2].predecessors).toEqual(['FINANCE_REVIEW', 'SECURITY_REVIEW']);
    expect(() =>
      renameApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', 'FINAL_REVIEW')
    ).toThrow(ApprovalTypedWorkflowError);
    expect(() => renameApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', 'bad')).toThrow(
      ApprovalTypedWorkflowError
    );
    expect(() => renameApprovalTypedWorkflowStage(source, 'UNKNOWN', 'NEW_REVIEW')).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it.each([
    { predecessors: ['FINAL_REVIEW'] },
    { predecessors: ['UNKNOWN'] },
    { predecessors: ['FINANCE_REVIEW'] },
    { predecessors: ['SECURITY_REVIEW', 'SECURITY_REVIEW'] },
  ])('rejects unsafe predecessor changes %j without mutating the source', ({ predecessors }) => {
    const source = definition();
    expect(() =>
      setApprovalTypedWorkflowPredecessors(source, 'FINANCE_REVIEW', predecessors)
    ).toThrow(ApprovalTypedWorkflowError);
    expect(source.stages[0].predecessors).toEqual([]);
  });

  it('allows explicit valid prerequisites, with SLA correction still required before compilation', () => {
    const source = definition();
    const changed = setApprovalTypedWorkflowPredecessors(source, 'SECURITY_REVIEW', [
      'FINANCE_REVIEW',
    ]);
    expect(changed.stages[1].predecessors).toEqual(['FINANCE_REVIEW']);
    expect(() => validateApprovalTypedWorkflow(changed)).toThrow(ApprovalTypedWorkflowError);
    expect(validateApprovalTypedWorkflow({ ...changed, slaMinutes: 90 }).stages).toHaveLength(3);
  });

  it('drops obsolete quorum value when switching to ANY/ALL and preserves COUNT/PERCENT', () => {
    const source = definition();
    expect(
      setApprovalTypedWorkflowQuorum(source, 'FINANCE_REVIEW', { mode: 'ALL' }).stages[0].quorum
    ).toEqual({ mode: 'ALL' });
    expect(
      setApprovalTypedWorkflowQuorum(source, 'SECURITY_REVIEW', { mode: 'COUNT', value: 3 })
        .stages[1].quorum
    ).toEqual({ mode: 'COUNT', value: 3 });
    expect(
      setApprovalTypedWorkflowQuorum(source, 'FINANCE_REVIEW', { mode: 'PERCENT', value: 67 })
        .stages[0].quorum
    ).toEqual({ mode: 'PERCENT', value: 67 });
    expect(source.stages[0].quorum).toEqual({ mode: 'COUNT', value: 2 });
  });

  it('edits name, actual role code and bounded SLA without changing mode or edges', () => {
    const source = definition();
    const changed = updateApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', {
      name: 'New finance',
      candidateRole: 'APPROVAL_OPERATOR',
      slaMinutes: 40,
    });
    expect(changed.stages[0]).toMatchObject({
      name: 'New finance',
      candidateRole: 'APPROVAL_OPERATOR',
      slaMinutes: 40,
      quorum: { mode: 'COUNT', value: 2 },
      predecessors: [],
    });
    expect(source.stages[0].name).toBe('Finance');
    expect(() =>
      updateApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', { candidateRole: 'R'.repeat(51) })
    ).toThrow(ApprovalTypedWorkflowError);
    expect(() =>
      updateApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', { candidateRole: undefined })
    ).toThrow(ApprovalTypedWorkflowError);
    expect(() =>
      updateApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', { slaMinutes: 14 })
    ).toThrow(ApprovalTypedWorkflowError);
    const incomplete = updateApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', {
      name: '',
      candidateRole: '',
    });
    expect(() => validateApprovalTypedWorkflow(incomplete)).toThrow(ApprovalTypedWorkflowError);
    expect(() => validateApprovalTypedWorkflow(setApprovalTypedWorkflowSla(source, 15))).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it('adds/edits/removes structured conditions, never a null placeholder property', async () => {
    const source = definition();
    const changed = setApprovalTypedWorkflowCondition(source, 'FINANCE_REVIEW', {
      all: [{ field: 'amount', operator: 'GTE', value: '12345678901234567890.12345678' }],
    });
    expect(changed.stages[0].routeCondition?.all[0].value).toBe('12345678901234567890.12345678');
    expect((await compileApprovalTypedWorkflow(changed)).definitionSha256).not.toBe(
      (await compileApprovalTypedWorkflow(source)).definitionSha256
    );
    const removed = setApprovalTypedWorkflowCondition(changed, 'FINANCE_REVIEW');
    expect(removed.stages[0]).not.toHaveProperty('routeCondition');
    expect(() => validateApprovalTypedWorkflow(removed)).not.toThrow();
    expect(() => setApprovalTypedWorkflowCondition(source, 'FINANCE_REVIEW', { all: [] })).toThrow(
      ApprovalTypedWorkflowError
    );
    expect(source.stages[0].routeCondition?.all[0].value).toEqual(['10', '20']);
  });

  it('does not delete or silently detach a referenced stage', () => {
    const source = definition();
    expect(() => removeApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW')).toThrow(
      ApprovalTypedWorkflowError
    );
    const removed = removeApprovalTypedWorkflowStage(source, 'FINAL_REVIEW');
    expect(removed.stages.map((stage) => stage.key)).toEqual(['FINANCE_REVIEW', 'SECURITY_REVIEW']);
    expect(() =>
      removeApprovalTypedWorkflowStage(createApprovalTypedWorkflowSeed(), 'REVIEW_1')
    ).toThrow(ApprovalTypedWorkflowError);
  });

  it('reorders only the persisted array, preserving dependencies and invalidating the client digest', async () => {
    const source = definition();
    const moved = moveApprovalTypedWorkflowStage(source, 'FINAL_REVIEW', -1);
    expect(moved.stages[1].key).toBe('FINAL_REVIEW');
    expect(moved.stages[1].predecessors).toEqual(source.stages[2].predecessors);
    expect((await compileApprovalTypedWorkflow(moved)).topologicalStageKeys).toEqual(
      (await compileApprovalTypedWorkflow(source)).topologicalStageKeys
    );
    expect((await compileApprovalTypedWorkflow(moved)).definitionSha256).not.toBe(
      (await compileApprovalTypedWorkflow(source)).definitionSha256
    );
    expect(moveApprovalTypedWorkflowStage(source, 'FINANCE_REVIEW', -1)).toBe(source);
  });
});
