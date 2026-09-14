import { describe, expect, it } from 'vitest';
import {
  approvalQuorumVotePrecondition,
  readApprovalQuorumTaskSnapshot,
  readApprovalQuorumVotePrecondition,
  sameApprovalQuorumTaskSnapshot,
} from './approval-quorum-contract';
const snapshot = {
  requestVersion: 8,
  generation: 2,
  stageVersion: 4,
  payloadRevision: 3,
  payloadSha256: 'a'.repeat(64),
  principalPersonPublicId: '11111111-1111-4111-8111-111111111111',
  pins: {
    workflowVersionId: '22222222-2222-4222-8222-222222222222',
    workflowVersion: 6,
    workflowDefinitionSha256: 'b'.repeat(64),
    formSchemaSha256: 'c'.repeat(64),
    policyVersion: 5,
    policySha256: 'd'.repeat(64),
  },
};
describe('immutable quorum client decision precondition', () => {
  it('preserves legacy absence, deeply freezes typed evidence and excludes principal/tenant from commands', () => {
    expect(readApprovalQuorumTaskSnapshot(null)).toBeNull();
    expect(approvalQuorumVotePrecondition(undefined)).toBeUndefined();
    const value = readApprovalQuorumTaskSnapshot(snapshot)!;
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.pins)).toBe(true);
    const command = approvalQuorumVotePrecondition(value)!;
    expect(command).toEqual({
      expectedRequestVersion: 8,
      generation: 2,
      expectedStageVersion: 4,
      payloadRevision: 3,
      payloadSha256: snapshot.payloadSha256,
      pins: snapshot.pins,
    });
    expect(command).not.toHaveProperty('principalPersonPublicId');
    expect(command).not.toHaveProperty('tenantId');
  });
  it.each(['generation', 'stageVersion', 'payloadRevision'] as const)(
    'rejects unsafe or zero %s',
    (field) => {
      for (const value of [0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1, '1'])
        expect(() => readApprovalQuorumTaskSnapshot({ ...snapshot, [field]: value })).toThrow();
    }
  );
  it.each([
    'requestVersion',
    'generation',
    'stageVersion',
    'payloadRevision',
    'payloadSha256',
    'principalPersonPublicId',
  ] as const)(
    'closes an open decision when %s changes even if task.version is unchanged',
    (field) => {
      const changed =
        field === 'payloadSha256'
          ? 'e'.repeat(64)
          : field === 'principalPersonPublicId'
            ? '33333333-3333-4333-8333-333333333333'
            : (snapshot[field] as number) + 1;
      expect(sameApprovalQuorumTaskSnapshot(snapshot, { ...snapshot, [field]: changed })).toBe(
        false
      );
    }
  );
  it.each([
    'workflowVersionId',
    'workflowVersion',
    'workflowDefinitionSha256',
    'formSchemaSha256',
    'policyVersion',
    'policySha256',
  ] as const)(
    'binds the exact %s instead of substituting fresh evidence into the old decision',
    (field) => {
      const original = snapshot.pins[field];
      const changed =
        typeof original === 'number'
          ? original + 1
          : field === 'workflowVersionId'
            ? '33333333-3333-4333-8333-333333333333'
            : 'e'.repeat(64);
      expect(
        sameApprovalQuorumTaskSnapshot(snapshot, {
          ...snapshot,
          pins: { ...snapshot.pins, [field]: changed },
        })
      ).toBe(false);
    }
  );
  it('rejects missing, foreign or over-broad topology and malformed immutable identifiers', () => {
    for (const value of [
      { ...snapshot, pins: { ...snapshot.pins, tenantId: 42 } },
      { ...snapshot, stageVersion: undefined },
      { ...snapshot, requestVersion: undefined },
      { ...snapshot, requestVersion: -1 },
      { ...snapshot, requestVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...snapshot, payloadSha256: 'A'.repeat(64) },
      { ...snapshot, principalPersonPublicId: '../person' },
      { ...snapshot, pins: { ...snapshot.pins, workflowVersionId: 'person@example.com' } },
    ])
      expect(() => readApprovalQuorumTaskSnapshot(value)).toThrow();
    expect(sameApprovalQuorumTaskSnapshot(snapshot, null)).toBe(false);
    expect(sameApprovalQuorumTaskSnapshot(undefined, null)).toBe(true);
  });
  it('rejects actor or tenant injection and zero versions in the outbound command topology', () => {
    const command = approvalQuorumVotePrecondition(snapshot)!;
    expect(readApprovalQuorumVotePrecondition(command)).toEqual(command);
    for (const value of [
      { ...command, tenantId: 42 },
      { ...command, principalPersonPublicId: snapshot.principalPersonPublicId },
      { ...command, generation: 0 },
      { ...command, expectedRequestVersion: undefined },
      { ...command, expectedRequestVersion: -1 },
      { ...command, pins: { ...command.pins, policyVersion: 0 } },
    ])
      expect(() => readApprovalQuorumVotePrecondition(value)).toThrow();
  });
  it('accepts request version zero but never substitutes a missing request version', () => {
    const value = readApprovalQuorumTaskSnapshot({ ...snapshot, requestVersion: 0 });
    expect(approvalQuorumVotePrecondition(value)?.expectedRequestVersion).toBe(0);
    expect(() => readApprovalQuorumTaskSnapshot({ ...snapshot, requestVersion: '0' })).toThrow();
  });
});
