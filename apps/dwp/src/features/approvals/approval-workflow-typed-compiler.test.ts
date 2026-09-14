import { describe, expect, it } from 'vitest';

import {
  compileApprovalTypedWorkflow,
  validateApprovalTypedWorkflow,
} from './approval-workflow-typed-compiler';
import {
  APPROVAL_TYPED_WORKFLOW_CONTRACT,
  ApprovalTypedWorkflowError,
  approvalTypedWorkflowThreshold,
} from './approval-workflow-typed-model';

import type { ApprovalTypedWorkflowQuorum } from './approval-workflow-typed-model';

function stage(
  key = 'FIRST_REVIEW',
  quorum: ApprovalTypedWorkflowQuorum = { mode: 'ANY' },
  predecessors: string[] = [],
  slaMinutes = 15
) {
  return {
    key,
    name: 'First review',
    candidateRole: 'APPROVAL_OPERATOR',
    quorum,
    slaMinutes,
    predecessors,
  };
}
function definition(
  stages: Array<ReturnType<typeof stage> & { routeCondition?: unknown }> = [stage()],
  slaMinutes = 15
) {
  return { schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT, schemaVersion: 2, slaMinutes, stages };
}
function reject(raw: unknown, code: string, path?: string) {
  try {
    validateApprovalTypedWorkflow(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(ApprovalTypedWorkflowError);
    expect(error).toMatchObject({ code, ...(path ? { path } : {}) });
    return;
  }
  throw new Error('Expected the closed workflow AST to reject this input.');
}

describe('Java ApprovalWorkflowQuorumDefinition closed AST parity', () => {
  it('matches the owner-approved FIRST_REVIEW canonical fixture without claiming capability', async () => {
    const compiled = await compileApprovalTypedWorkflow(definition());
    expect(compiled.canonicalJson).toBe(
      '{"schemaContract":"DWP_APPROVAL_WORKFLOW_QUORUM_V2","schemaVersion":2,"slaMinutes":15,"stages":[{"candidateRole":"APPROVAL_OPERATOR","key":"FIRST_REVIEW","name":"First review","predecessors":[],"quorum":{"mode":"ANY"},"slaMinutes":15}]}'
    );
    expect(compiled.definitionSha256).toBe(
      'f44039fc1b960a7ef52555a0796c4a069edf47e984c97b0f7f383a787d8f8323'
    );
    expect(compiled).not.toHaveProperty('available');
    expect(compiled).not.toHaveProperty('candidateCount');
    expect(compiled).not.toHaveProperty('hasVeto');
  });

  it('sorts object properties but preserves stage and predecessor array order in the hash', async () => {
    const finance = stage('FINANCE_REVIEW', { mode: 'COUNT', value: 2 }, [], 30);
    const security = stage('SECURITY_REVIEW', { mode: 'ALL' }, [], 45);
    const final = stage('FINAL_REVIEW', { mode: 'ANY' }, ['FINANCE_REVIEW', 'SECURITY_REVIEW']);
    const original = await compileApprovalTypedWorkflow(definition([security, final, finance], 60));
    expect(original.topologicalStageKeys).toEqual([
      'FINANCE_REVIEW',
      'SECURITY_REVIEW',
      'FINAL_REVIEW',
    ]);
    expect(original.levels).toEqual([['FINANCE_REVIEW', 'SECURITY_REVIEW'], ['FINAL_REVIEW']]);
    expect(original.longestPathMinutes).toBe(60);
    expect(original.definition.stages.map((item) => item.key)).toEqual([
      'SECURITY_REVIEW',
      'FINAL_REVIEW',
      'FINANCE_REVIEW',
    ]);
    const reversedKeys = {
      stages: [security, final, finance],
      slaMinutes: 60,
      schemaVersion: 2,
      schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT,
    };
    expect((await compileApprovalTypedWorkflow(reversedKeys)).definitionSha256).toBe(
      original.definitionSha256
    );
    expect(
      (await compileApprovalTypedWorkflow(definition([finance, security, final], 60)))
        .definitionSha256
    ).not.toBe(original.definitionSha256);
    expect(
      (
        await compileApprovalTypedWorkflow(
          definition(
            [security, { ...final, predecessors: ['SECURITY_REVIEW', 'FINANCE_REVIEW'] }, finance],
            60
          )
        )
      ).definitionSha256
    ).not.toBe(original.definitionSha256);
    reject(definition([finance, security, final], 59), 'longest-path-sla', 'slaMinutes');
  });

  it('clones and deeply freezes the definition, conditions, predecessors and graph output', async () => {
    const condition = { all: [{ field: 'amount', operator: 'IN', value: ['10', '20'] }] };
    const raw = definition([{ ...stage(), routeCondition: condition }]);
    const compiled = await compileApprovalTypedWorkflow(raw);
    raw.stages[0].name = 'Changed';
    condition.all[0].value.push('30');
    raw.stages.length = 0;
    expect(compiled.definition.stages[0].name).toBe('First review');
    expect(compiled.definition.stages[0].routeCondition?.all[0].value).toEqual(['10', '20']);
    expect(Object.isFrozen(compiled.definition.stages[0].routeCondition?.all)).toBe(true);
    expect(Object.isFrozen(compiled.levels[0])).toBe(true);
  });

  it.each(['N_OF_M', 'PARALLEL', 'SERIAL', 'VETO', 'any', 'SEQUENTIAL', 'MAJORITY', 'SCRIPT'])(
    'rejects conceptual or loose JSON mode %s',
    (mode) => {
      reject({ ...definition(), stages: [{ ...stage(), quorum: { mode } }] }, 'quorum-mode');
    }
  );

  it.each([
    { mode: 'ANY', value: null },
    { mode: 'ALL', value: 2 },
    { mode: 'COUNT' },
    { mode: 'COUNT', value: '2' },
    { mode: 'COUNT', value: 0 },
    { mode: 'COUNT', value: 1001 },
    { mode: 'PERCENT', value: 101 },
    { mode: 'PERCENT', value: 2.5 },
    { mode: 'COUNT', value: Number.NaN },
    { mode: 'COUNT', value: Number.POSITIVE_INFINITY },
  ])('rejects exact invalid quorum arguments %j', (quorum) => {
    expect(() =>
      validateApprovalTypedWorkflow({ ...definition(), stages: [{ ...stage(), quorum }] })
    ).toThrow(ApprovalTypedWorkflowError);
  });

  it.each([
    { extra: true },
    { sourceId: 'fabricated' },
    { schemaContract: 'UNKNOWN' },
    { schemaVersion: '2' },
    { schemaVersion: 1 },
    { slaMinutes: '15' },
    { slaMinutes: 14 },
    { slaMinutes: 525601 },
  ])('rejects root contract coercion or extra properties %j', (patch) => {
    expect(() => validateApprovalTypedWorkflow({ ...definition(), ...patch })).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it.each([
    { hasVeto: true },
    { mode: 'SERIAL' },
    { expression: 'approve()' },
    { candidateSourceId: 'uuid' },
    { candidateRole: 'lower_case' },
    { routeCondition: null },
  ])('rejects unsupported stage properties %j', (patch) => {
    expect(() =>
      validateApprovalTypedWorkflow({ ...definition(), stages: [{ ...stage(), ...patch }] })
    ).toThrow(ApprovalTypedWorkflowError);
  });

  it('does not reinterpret an unmarked legacy definition or raw duplicate-key JSON', () => {
    reject({ schemaVersion: 2, steps: [{ mode: 'ANY' }] }, 'properties-mismatch');
    reject(JSON.stringify(definition()), 'object-required');
    reject(
      '{"schemaContract":"UNKNOWN","schemaContract":"DWP_APPROVAL_WORKFLOW_QUORUM_V2"}',
      'object-required'
    );
  });

  it('rejects inherited, symbolic, accessor and sparse AST data without invoking getters', () => {
    reject(Object.create(definition()), 'plain-object-required');
    reject(Object.assign(definition(), { [Symbol('hidden')]: true }), 'json-properties-required');
    let invoked = false;
    const raw = definition();
    Object.defineProperty(raw, 'slaMinutes', {
      enumerable: true,
      get: () => {
        invoked = true;
        return 15;
      },
    });
    reject(raw, 'json-properties-required');
    expect(invoked).toBe(false);
    reject({ ...definition(), stages: new Array(1) }, 'object-required', 'stages[0]');
  });

  it.each([
    { stages: [stage('AA', { mode: 'ANY' }, ['BB']), stage('BB', { mode: 'ANY' }, ['AA'])] },
    { stages: [stage('AA', { mode: 'ANY' }, ['UNKNOWN'])] },
    { stages: [stage('AA', { mode: 'ANY' }, ['AA'])] },
    { stages: [stage('AA', { mode: 'ANY' }, ['BB', 'BB']), stage('BB')] },
    { stages: [stage('AA'), stage('AA')] },
  ])('rejects cyclic, unknown, self or duplicate dependency graph %#', ({ stages }) => {
    expect(() => validateApprovalTypedWorkflow(definition(stages, 60))).toThrow(
      ApprovalTypedWorkflowError
    );
  });

  it('uses the typed 64-stage bound, not legacy20 or the sum of parallel SLAs', () => {
    const stages = Array.from({ length: 64 }, (_, index) => stage(`REVIEW_${index}`));
    expect(validateApprovalTypedWorkflow(definition(stages)).stages).toHaveLength(64);
    reject(definition([...stages, stage('REVIEW_64')]), 'stage-count');
    reject(definition([]), 'stage-count');
  });

  it('matches Java strip/name120 and uppercase Jackson control escapes', async () => {
    reject(definition([{ ...stage(), name: '\u2003Review' }]), 'stage-name');
    reject(definition([{ ...stage(), name: 'Review ' }]), 'stage-name');
    reject(definition([{ ...stage(), name: 'R'.repeat(121) }]), 'stage-name');
    expect(
      validateApprovalTypedWorkflow(definition([{ ...stage(), name: '\u00a0Review\u00a0' }]))
        .stages[0].name
    ).toBe('\u00a0Review\u00a0');
    const compiled = await compileApprovalTypedWorkflow(
      definition([{ ...stage(), name: 'R\u001a\n"\\' }])
    );
    expect(compiled.canonicalJson).toContain(['R', '\\u001A', '\\n', '\\' + '"', '\\\\'].join(''));
  });

  it('bounds the client canonical transport without silently truncating clauses', async () => {
    const stages = Array.from({ length: 64 }, (_, index) => ({
      ...stage(`REVIEW_${index}`),
      routeCondition: { all: [{ field: 'summary', operator: 'EQ', value: 'x'.repeat(2000) }] },
    }));
    await expect(compileApprovalTypedWorkflow(definition(stages))).rejects.toMatchObject({
      code: 'definition-size',
    });
  });
});

describe('Java Rule threshold arithmetic only', () => {
  it.each<[ApprovalTypedWorkflowQuorum, number, number]>([
    [{ mode: 'ANY' }, 3, 1],
    [{ mode: 'ALL' }, 3, 3],
    [{ mode: 'COUNT', value: 2 }, 3, 2],
    [{ mode: 'PERCENT', value: 67 }, 3, 3],
    [{ mode: 'PERCENT', value: 1 }, 3, 1],
    [{ mode: 'PERCENT', value: 100 }, 1000, 1000],
  ])('does not coerce or round down quorum seats %j/%i', (quorum, count, expected) => {
    expect(approvalTypedWorkflowThreshold(quorum, count)).toBe(expected);
  });
  it('rejects unknown/empty/unsafe pools and a COUNT larger than the complete pool', () => {
    expect(() => approvalTypedWorkflowThreshold({ mode: 'COUNT', value: 4 }, 3)).toThrow(
      ApprovalTypedWorkflowError
    );
    for (const count of [0, 1001, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(() => approvalTypedWorkflowThreshold({ mode: 'ANY' }, count)).toThrow(
        ApprovalTypedWorkflowError
      );
  });
});
