import type { AppAdminPresetAssignment } from '@dwp-frontend/shared-utils';

export type PresetAssignmentActorStage = {
  role: 'REQUESTER' | 'APPROVER' | 'ACTIVATOR';
  state: 'RECORDED' | 'PENDING' | 'NOT_RECORDED';
  actorId?: number;
  actorName?: string;
  recordedAt?: string;
};

export type PresetAssignmentProgress = {
  assignment: AppAdminPresetAssignment;
  stages: PresetAssignmentActorStage[];
  separation: 'COMPLETE' | 'PENDING' | 'VIOLATION';
};

function targetUserId(assignment: AppAdminPresetAssignment): number | undefined {
  if (assignment.principalType !== 'USER' || !/^\d+$/.test(assignment.principalRef))
    return undefined;
  return Number(assignment.principalRef);
}

function actorStage(
  role: PresetAssignmentActorStage['role'],
  actorId: number | null | undefined,
  actorName: string | null | undefined,
  recordedAt: string | null | undefined,
  pending: boolean
): PresetAssignmentActorStage {
  return {
    role,
    state: actorId != null || recordedAt ? 'RECORDED' : pending ? 'PENDING' : 'NOT_RECORDED',
    actorId: actorId ?? undefined,
    actorName: actorName?.trim() || undefined,
    recordedAt: recordedAt ?? undefined,
  };
}

export function resolvePresetAssignmentProgress(
  assignment: AppAdminPresetAssignment
): PresetAssignmentProgress {
  const stages = [
    actorStage(
      'REQUESTER',
      assignment.requestedBy,
      assignment.requestedByName,
      assignment.createdAt,
      false
    ),
    actorStage(
      'APPROVER',
      assignment.approvedBy,
      assignment.approvedByName,
      assignment.approvedAt,
      assignment.lifecycleState === 'PENDING_APPROVAL'
    ),
    actorStage(
      'ACTIVATOR',
      assignment.activatedBy,
      assignment.activatedByName,
      assignment.activatedAt,
      assignment.lifecycleState === 'APPROVED'
    ),
  ];
  const requiredIds = [assignment.requestedBy, assignment.approvedBy, assignment.activatedBy];
  const target = targetUserId(assignment);
  const knownActorIds = requiredIds.filter((value): value is number => value != null);
  const duplicatedActor = new Set(knownActorIds).size !== knownActorIds.length;
  // A user may request a preset for themself. Only the approver and activator must remain
  // independent of the target, matching the server-side self-approval/self-fulfilment guards.
  const targetDutyConflict =
    target != null &&
    (Object.is(assignment.approvedBy, target) || Object.is(assignment.activatedBy, target));
  const completeActors = requiredIds.every((value) => value != null);
  const knownTarget = assignment.principalType === 'GROUP' || target != null;

  return {
    assignment,
    stages,
    separation:
      duplicatedActor || targetDutyConflict
        ? 'VIOLATION'
        : assignment.lifecycleState === 'ACTIVE' && completeActors && knownTarget
          ? 'COMPLETE'
          : 'PENDING',
  };
}

const assignmentPriority: Record<AppAdminPresetAssignment['lifecycleState'], number> = {
  PENDING_APPROVAL: 0,
  APPROVED: 1,
  ACTIVE: 2,
  DENIED: 3,
  REVOKED: 4,
  EXPIRED: 5,
};

export function selectPresetAssignmentForInspection(
  assignments: readonly AppAdminPresetAssignment[]
): AppAdminPresetAssignment | undefined {
  return [...assignments].sort((left, right) => {
    const priority =
      assignmentPriority[left.lifecycleState] - assignmentPriority[right.lifecycleState];
    return priority || Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  })[0];
}
