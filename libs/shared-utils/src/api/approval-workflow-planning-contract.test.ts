import { describe, expect, it } from 'vitest';
import {
  planningInputFixture,
  planningResultFixture,
  planningSelectionFixture,
} from '../test-utils/approval-workflow-planning-fixtures';
import {
  captureApprovalWorkflowPlanningInput,
  readApprovalWorkflowPlanningResult,
  readApprovalWorkflowPlanningSelection,
} from './approval-workflow-planning-contract';

describe('closed native workflow planning pins and role pool semantics', () => {
  it('captures immutable native9/2/5 without alias or invented policy', () => {
    const input = planningSelectionFixture();
    const result = readApprovalWorkflowPlanningSelection(input);
    input.policy.version = 50;
    expect(result.policy.version).toBe(3);
    expect(Object.isFrozen(result.forms[0])).toBe(true);
  });
  it.each([
    'extra',
    'hash',
    'revision',
    'selected',
    'duplicate',
    'overflow',
    'policy',
    'formVersion',
  ])('fails closed for selection %s', (kind) => {
    const selection = planningSelectionFixture();
    const invalid = {
      ...selection,
      ...(kind === 'extra' ? { candidateIds: [99] } : {}),
      ...(kind === 'hash' ? { workflowSha256: 'A'.repeat(64) } : {}),
      ...(kind === 'revision' ? { workflowRevision: -1 } : {}),
      ...(kind === 'selected' ? { selectedFormId: selection.workflowId } : {}),
      ...(kind === 'duplicate' ? { forms: [selection.forms[0], selection.forms[0]] } : {}),
      ...(kind === 'overflow'
        ? { forms: Array.from({ length: 101 }, () => selection.forms[0]) }
        : {}),
      ...(kind === 'policy' ? { policy: { ...selection.policy, fakeReady: true } } : {}),
      ...(kind === 'formVersion' ? { forms: [{ ...selection.forms[0], formVersion: 0 }] } : {}),
    };
    expect(() => readApprovalWorkflowPlanningSelection(invalid)).toThrow();
  });
  it.each(['ANY', 'ALL', 'COUNT', 'PERCENT'] as const)(
    'checks %s threshold against complete bounded pool',
    (mode) => {
      const input = planningResultFixture();
      input.stages[0] = {
        ...input.stages[0]!,
        quorumMode: mode,
        quorumValue: mode === 'COUNT' ? 2 : mode === 'PERCENT' ? 67 : null,
        indicativeThreshold: mode === 'ANY' ? 1 : mode === 'COUNT' ? 2 : 3,
      } as (typeof input.stages)[number];
      expect(readApprovalWorkflowPlanningResult(input).stages[0]?.indicativeThreshold).toBe(
        input.stages[0].indicativeThreshold
      );
    }
  );
  it.each([0, 1, 2, 3, 1000])('uses PERCENT ceiling for pool %i', (count) => {
    const value = planningResultFixture();
    Object.assign(value.stages[0]!, {
      activeMemberCount: count,
      indicativeThreshold: count ? Math.ceil((count * 67) / 100) : null,
      poolWarning: count ? null : 'EMPTY_POOL',
    });
    expect(readApprovalWorkflowPlanningResult(value).stages[0]?.activeMemberCount).toBe(count);
  });
  it.each([
    'runtimeReady',
    'requesterExcluded',
    'expired',
    'floor',
    'excessPool',
    'wrongWarning',
    'unknownStep',
    'duplicateStep',
  ])('rejects false or inconsistent preview %s', (kind) => {
    const value = planningResultFixture();
    const stage = value.stages[0]!;
    expect(() =>
      readApprovalWorkflowPlanningResult({
        ...value,
        ...(kind === 'runtimeReady' ? { runtimeEligibility: 'READY' } : {}),
        ...(kind === 'requesterExcluded' ? { requesterExclusion: 'VERIFIED' } : {}),
        ...(kind === 'expired' ? { expiresAt: new Date(Date.now() - 1).toISOString() } : {}),
        stages:
          kind === 'duplicateStep'
            ? [stage, stage]
            : [
                {
                  ...stage,
                  ...(kind === 'floor' ? { indicativeThreshold: 2 } : {}),
                  ...(kind === 'excessPool' ? { activeMemberCount: 1001 } : {}),
                  ...(kind === 'wrongWarning' ? { poolWarning: 'EMPTY_POOL' } : {}),
                  ...(kind === 'unknownStep' ? { predecessors: ['UNKNOWN'] } : {}),
                },
              ],
      })
    ).toThrow();
  });
  it('preserves plain decimal strings in sample without coercion or caller IDs', () => {
    const input = planningInputFixture();
    const result = captureApprovalWorkflowPlanningInput(input);
    expect(result.samplePayload.amount).toBe('20.01');
    expect(Object.keys(result)).toHaveLength(8);
  });
  it.each([NaN, Infinity, 1.5, undefined, new Date(), new Map(), BigInt(1)])(
    'rejects non JSON/unsafe sample %s',
    (value) => {
      expect(() =>
        captureApprovalWorkflowPlanningInput({
          ...planningInputFixture(),
          samplePayload: { amount: value },
        })
      ).toThrow();
    }
  );
});
