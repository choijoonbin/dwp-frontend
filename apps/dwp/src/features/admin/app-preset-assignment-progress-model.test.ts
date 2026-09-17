import { describe, expect, it } from 'vitest';

import type { AppAdminPresetAssignment } from '@dwp-frontend/shared-utils';

import {
  resolvePresetAssignmentProgress,
  selectPresetAssignmentForInspection,
} from './app-preset-assignment-progress-model';

function assignment(
  state: AppAdminPresetAssignment['lifecycleState'],
  actors: Partial<AppAdminPresetAssignment> = {}
): AppAdminPresetAssignment {
  return {
    presetAssignmentId: `assignment-${state}`,
    presetCode: 'MAIL_ADMIN',
    productKey: 'mail',
    presetName: 'Mail administrator',
    principalType: 'USER',
    principalRef: '40',
    principalName: 'Target user',
    resourceSetId: 'rs-mail',
    resourceSetKey: 'RS_MAIL',
    resourceSetName: 'Mail',
    responsibilityAssignmentId: 'responsibility-1',
    assignmentSource: 'GOVERNED_PRESET',
    requestChannel: 'GOVERNANCE',
    lifecycleState: state,
    validTo: '2026-12-31T00:00:00Z',
    reviewDueAt: '2026-12-01T00:00:00Z',
    justification: 'Temporary operational coverage',
    requestedBy: 10,
    requestedByName: 'Requester',
    version: 1,
    catalogVersion: 1,
    createdAt: '2026-09-17T01:00:00Z',
    updatedAt: '2026-09-17T01:00:00Z',
    duties: [],
    ...actors,
  };
}

describe('app administrator preset progress', () => {
  it('keeps the unrecorded approver and activator stages pending', () => {
    const progress = resolvePresetAssignmentProgress(assignment('PENDING_APPROVAL'));

    expect(progress.separation).toBe('PENDING');
    expect(progress.stages.map((stage) => [stage.role, stage.state])).toEqual([
      ['REQUESTER', 'RECORDED'],
      ['APPROVER', 'PENDING'],
      ['ACTIVATOR', 'NOT_RECORDED'],
    ]);
  });

  it('confirms separation only from complete distinct actor identifiers', () => {
    const progress = resolvePresetAssignmentProgress(
      assignment('ACTIVE', {
        approvedBy: 20,
        approvedByName: 'Approver',
        approvedAt: '2026-09-17T02:00:00Z',
        activatedBy: 30,
        activatedByName: 'Activator',
        activatedAt: '2026-09-17T03:00:00Z',
      })
    );

    expect(progress.separation).toBe('COMPLETE');
  });

  it('preserves an allowed self-service request when approval and activation stay independent', () => {
    const progress = resolvePresetAssignmentProgress(
      assignment('ACTIVE', {
        requestedBy: 40,
        requestedByName: 'Target user',
        approvedBy: 20,
        approvedAt: '2026-09-17T02:00:00Z',
        activatedBy: 30,
        activatedAt: '2026-09-17T03:00:00Z',
      })
    );

    expect(progress.separation).toBe('COMPLETE');
  });

  it('detects a target or lifecycle actor reused in a separated duty', () => {
    const progress = resolvePresetAssignmentProgress(
      assignment('ACTIVE', {
        approvedBy: 10,
        approvedAt: '2026-09-17T02:00:00Z',
        activatedBy: 40,
        activatedAt: '2026-09-17T03:00:00Z',
      })
    );

    expect(progress.separation).toBe('VIOLATION');
  });

  it('selects the actionable assignment before active history', () => {
    expect(
      selectPresetAssignmentForInspection([
        assignment('ACTIVE'),
        assignment('APPROVED'),
        assignment('PENDING_APPROVAL'),
      ])?.lifecycleState
    ).toBe('PENDING_APPROVAL');
  });
});
