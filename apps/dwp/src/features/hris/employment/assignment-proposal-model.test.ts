import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  assignmentProposalCanSubmit,
  assignmentProposalCanCancel,
  assignmentProposalActionAvailable,
  assignmentProposalAllowedChangeTypes,
  assignmentProposalCreateReference,
  assignmentProposalDateBoundary,
  assignmentProposalDraftIsComplete,
  assignmentProposalFailureKind,
  assignmentProposalHasCompletedValidation,
  buildCreateAssignmentProposalRequest,
  resolveAssignmentProposalSelection,
} from './assignment-proposal-model';

import type { AssignmentDetail, AssignmentProposal } from '@dwp-frontend/shared-utils';

const assignment = {
  assignmentId: '90e4cd45-6f91-4ac7-974e-6bc49f1b910b',
  assignmentVersion: 7,
  effectiveStartDate: '2026-01-01',
  effectiveEndDate: null,
} satisfies Pick<
  AssignmentDetail,
  'assignmentId' | 'assignmentVersion' | 'effectiveStartDate' | 'effectiveEndDate'
>;

const proposal = {
  lifecycleState: 'VALIDATED',
  validationFindings: [],
} satisfies Pick<AssignmentProposal, 'lifecycleState' | 'validationFindings'>;

describe('assignment proposal workflow model', () => {
  it('builds the happy-path transfer command from the canonical assignment version', () => {
    expect(
      buildCreateAssignmentProposalRequest(
        assignment,
        {
          changeType: 'TRANSFER',
          effectiveDate: '2026-11-01',
          reasonCode: 'ORG_REALIGNMENT',
          changeValue: 'f825a6b0-2d9e-490f-8dcb-8a450fc82437',
        },
        '12ea3741-9cbc-44b5-90bc-9a19021ca131',
        '2026-10-06'
      )
    ).toEqual({
      commandId: '12ea3741-9cbc-44b5-90bc-9a19021ca131',
      targetAssignmentId: assignment.assignmentId,
      changeType: 'TRANSFER',
      effectiveDate: '2026-11-01',
      reasonCode: 'ORG_REALIGNMENT',
      proposedChanges: { organizationId: 'f825a6b0-2d9e-490f-8dcb-8a450fc82437' },
      expectedAssignmentVersion: 7,
    });
    expect(assignmentProposalCanSubmit(proposal)).toBe(true);
    expect(
      assignmentProposalHasCompletedValidation({
        lifecycleState: 'SUBMITTED',
        validationFindings: [],
      })
    ).toBe(true);
  });

  it('fails closed for denied proposal reads or commands', () => {
    expect(assignmentProposalFailureKind(new HttpError('Forbidden', 403))).toBe('DENIED');
    expect(
      assignmentProposalActionAvailable({
        accessMode: 'PROVIDER_SUPPORT',
        governed: false,
        capabilityGranted: true,
        roles: ['HR_ADMIN'],
      })
    ).toBe(false);
  });

  it('separates optimistic conflicts from validation failures', () => {
    expect(
      assignmentProposalFailureKind(
        new HttpError('Changed', 409, { errorCode: 'OBJECT_VERSION_CONFLICT' })
      )
    ).toBe('CONFLICT');
    expect(assignmentProposalFailureKind(new HttpError('Invalid', 400))).toBe('INVALID');
  });

  it('preserves proposal and create-workspace deep links during partial recovery', () => {
    const createRef = assignmentProposalCreateReference(assignment.assignmentId);
    expect(resolveAssignmentProposalSelection(createRef)).toEqual({
      kind: 'create',
      assignmentId: assignment.assignmentId,
    });
    expect(resolveAssignmentProposalSelection('proposal-42')).toEqual({
      kind: 'proposal',
      proposalId: 'proposal-42',
    });
    expect(assignmentProposalFailureKind(new Error('timeline unavailable'))).toBe('UNAVAILABLE');
  });

  it('uses canonical workforce keys and permits cancellation after submission', () => {
    const promotion = {
      changeType: 'PROMOTION',
      effectiveDate: '2026-11-01',
      reasonCode: 'PROMOTION',
      changeValue: 'JOB.PROFILE-9',
    } as const;
    expect(assignmentProposalDraftIsComplete(promotion)).toBe(true);
    expect(
      buildCreateAssignmentProposalRequest(assignment, promotion, 'command-promotion', '2026-10-06')
        .proposedChanges
    ).toEqual({ jobProfileKey: 'JOB.PROFILE-9' });
    expect(
      buildCreateAssignmentProposalRequest(
        assignment,
        { ...promotion, changeType: 'CHANGE_LOCATION', changeValue: 'SEOUL_HQ' },
        'command-location',
        '2026-10-06'
      ).proposedChanges
    ).toEqual({ locationKey: 'SEOUL_HQ' });
    expect(assignmentProposalCanCancel({ ...proposal, lifecycleState: 'SUBMITTED' })).toBe(true);
  });

  it('allows corrections only inside the target assignment slice through today', () => {
    expect(
      assignmentProposalDateBoundary(
        'CORRECTION',
        { effectiveStartDate: '2025-01-01', effectiveEndDate: null },
        '2026-10-06'
      )
    ).toEqual({ minDate: '2025-01-01', maxDate: '2026-10-06' });
    expect(
      assignmentProposalDateBoundary(
        'CORRECTION',
        { effectiveStartDate: '2025-01-01', effectiveEndDate: '2026-06-30' },
        '2026-10-06'
      )
    ).toEqual({ minDate: '2025-01-01', maxDate: '2026-06-30' });
    expect(
      assignmentProposalDateBoundary(
        'TRANSFER',
        { effectiveStartDate: '2025-01-01', effectiveEndDate: null },
        '2026-10-06'
      )
    ).toEqual({ minDate: '2026-10-06', maxDate: null });
  });

  it('allows prospective changes only when the target slice includes today', () => {
    expect(assignmentProposalAllowedChangeTypes(assignment, '2026-10-06')).toEqual([
      'TRANSFER',
      'PROMOTION',
      'DEMOTION',
      'CHANGE_MANAGER',
      'CHANGE_LOCATION',
      'CORRECTION',
    ]);

    const historicalAssignment = {
      ...assignment,
      effectiveEndDate: '2026-06-30',
    };
    expect(assignmentProposalAllowedChangeTypes(historicalAssignment, '2026-10-06')).toEqual([
      'CORRECTION',
    ]);
    expect(
      assignmentProposalAllowedChangeTypes(
        { ...assignment, effectiveStartDate: '2026-11-01' },
        '2026-10-06'
      )
    ).toEqual(['CORRECTION']);
    expect(() =>
      buildCreateAssignmentProposalRequest(
        historicalAssignment,
        {
          changeType: 'TRANSFER',
          effectiveDate: '2026-10-06',
          reasonCode: 'ORG_REALIGNMENT',
          changeValue: 'f825a6b0-2d9e-490f-8dcb-8a450fc82437',
        },
        'command-historical-transfer',
        '2026-10-06'
      )
    ).toThrow('Prospective changes require an assignment slice that includes today.');
  });
});
