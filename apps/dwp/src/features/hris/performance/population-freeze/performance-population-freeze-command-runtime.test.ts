import { describe, expect, it } from 'vitest';

import {
  PERFORMANCE_POPULATION_FREEZE_HIGH_RISK_OPERATION,
  performancePopulationFreezeHighRiskCommand,
} from './performance-population-freeze-command-runtime';
import { PERFORMANCE_POPULATION_FREEZE_CAPABILITY } from './population-freeze-contract';

import type { ComponentProps } from 'react';
import type {
  HrisPerformanceReviewOperationsPopulationFreezeRuntime,
  HrisPerformanceReviewOperationsWorkspace,
} from './index';

const CYCLE_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';

const command = Object.freeze({
  commandId: COMMAND_ID,
  expectedCycleRevision: 4,
  populationPreviewId: '33333333-3333-4333-8333-333333333333',
  populationRuleId: '44444444-4444-4444-8444-444444444444',
  workforceSnapshotId: '55555555-5555-4555-8555-555555555555',
  workforceSnapshotRevision: 31,
  previewContentHash: 'a'.repeat(64),
  reason: 'Reviewed the exact population evidence.',
});

describe('performance population-freeze production command runtime', () => {
  it('binds one immutable HIGH descriptor without putting object version in the body', () => {
    const descriptor = performancePopulationFreezeHighRiskCommand({
      cycleId: CYCLE_ID,
      command,
    });

    expect(descriptor).toEqual({
      operation: PERFORMANCE_POPULATION_FREEZE_HIGH_RISK_OPERATION,
      commandMethod: 'POST',
      commandPath: `/api/people/v1/hris/performance/cycles/${CYCLE_ID}/population-freezes`,
      targetType: 'PERFORMANCE_CYCLE',
      targetId: CYCLE_ID,
      expectedObjectVersion: 4,
      payload: {
        commandId: COMMAND_ID,
        populationPreviewId: command.populationPreviewId,
        populationRuleId: command.populationRuleId,
        workforceSnapshotId: command.workforceSnapshotId,
        workforceSnapshotRevision: 31,
        previewContentHash: command.previewContentHash,
        reason: command.reason,
      },
      idempotencyKey: COMMAND_ID,
      idempotencyPayloadPath: 'ROOT_COMMAND_ID',
    });
    expect(descriptor.payload).not.toHaveProperty('expectedCycleRevision');
    expect(PERFORMANCE_POPULATION_FREEZE_CAPABILITY).toBe('hcm.operations.performance.freeze');
  });

  it('requires an executor provider at the workspace boundary and hides it from Control runtime', () => {
    type WorkspaceProps = ComponentProps<typeof HrisPerformanceReviewOperationsWorkspace>;
    type RuntimeProps = ComponentProps<
      typeof HrisPerformanceReviewOperationsPopulationFreezeRuntime
    >;
    type WorkspaceRequiresProvider = undefined extends WorkspaceProps['commandExecutors']
      ? false
      : true;
    type ControlCannotInjectExecutors = 'commandExecutors' extends keyof RuntimeProps
      ? false
      : true;
    const workspaceRequiresProvider: WorkspaceRequiresProvider = true;
    const controlCannotInjectExecutors: ControlCannotInjectExecutors = true;

    expect(workspaceRequiresProvider).toBe(true);
    expect(controlCannotInjectExecutors).toBe(true);
  });
});
