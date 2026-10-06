import { ASSIGNMENT_CHANGE_TYPES, HttpError } from '@dwp-frontend/shared-utils';

import type {
  AssignmentChangeType,
  AssignmentDetail,
  AssignmentProposal,
  CreateAssignmentProposalRequest,
} from '@dwp-frontend/shared-utils';

export const ASSIGNMENT_PROPOSAL_ROUTE_BINDINGS = {
  create: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-proposal-create.action',
    taskKind: 'OPERATIONS',
  },
  validate: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-proposal-validate.action',
    taskKind: 'OPERATIONS',
  },
  cancel: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-proposal-cancel.action',
    taskKind: 'OPERATIONS',
  },
} as const;

export type AssignmentProposalSelection =
  | Readonly<{ kind: 'create'; assignmentId: string }>
  | Readonly<{ kind: 'proposal'; proposalId: string }>;

export type AssignmentProposalDraft = Readonly<{
  changeType: AssignmentChangeType;
  effectiveDate: string;
  reasonCode: string;
  changeValue: string;
}>;

export type AssignmentProposalFailureKind = 'DENIED' | 'CONFLICT' | 'INVALID' | 'UNAVAILABLE';

const LEGACY_ASSIGNMENT_MANAGERS = new Set(['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN']);

const CREATE_PREFIX = 'new:';
const CORRECTION_ONLY_CHANGE_TYPES = ['CORRECTION'] as const;
const CHANGE_FIELD_BY_TYPE: Readonly<Record<AssignmentChangeType, string>> = {
  TRANSFER: 'organizationId',
  PROMOTION: 'jobProfileKey',
  DEMOTION: 'jobProfileKey',
  CHANGE_MANAGER: 'managerAssignmentId',
  CHANGE_LOCATION: 'locationKey',
  CORRECTION: 'businessTitle',
};

function nonBlank(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function assignmentProposalCreateReference(assignmentId: string): string {
  return `${CREATE_PREFIX}${assignmentId}`;
}

export function resolveAssignmentProposalSelection(
  value: string | null | undefined
): AssignmentProposalSelection | null {
  if (!nonBlank(value)) return null;
  if (value.startsWith(CREATE_PREFIX)) {
    const assignmentId = value.slice(CREATE_PREFIX.length).trim();
    return assignmentId ? { kind: 'create', assignmentId } : null;
  }
  return { kind: 'proposal', proposalId: value.trim() };
}

export function assignmentProposalFailureKind(error: unknown): AssignmentProposalFailureKind {
  if (!(error instanceof HttpError)) return 'UNAVAILABLE';
  if (error.status === 401 || error.status === 403 || error.status === 404) return 'DENIED';
  if (error.status === 409) return 'CONFLICT';
  if (error.status === 400 || error.status === 422) return 'INVALID';
  return 'UNAVAILABLE';
}

export function assignmentProposalActionAvailable(
  input: Readonly<{
    accessMode: string;
    governed: boolean;
    capabilityGranted: boolean;
    roles: readonly string[];
  }>
): boolean {
  if (input.accessMode === 'PROVIDER_SUPPORT') return false;
  return input.governed
    ? input.capabilityGranted
    : input.roles.some((role) => LEGACY_ASSIGNMENT_MANAGERS.has(role));
}

export function assignmentProposalHasBlockingFindings(
  proposal: Pick<AssignmentProposal, 'validationFindings'>
): boolean {
  return proposal.validationFindings.some(
    (finding) => finding.severity.trim().toUpperCase() === 'ERROR'
  );
}

export function assignmentProposalHasCompletedValidation(
  proposal: Pick<AssignmentProposal, 'lifecycleState' | 'validationFindings'>
): boolean {
  return (
    (proposal.lifecycleState === 'VALIDATED' || proposal.lifecycleState === 'SUBMITTED') &&
    !assignmentProposalHasBlockingFindings(proposal)
  );
}

export function assignmentProposalChangedField(changeType: AssignmentChangeType): string {
  return CHANGE_FIELD_BY_TYPE[changeType];
}

export function assignmentProposalDateBoundary(
  changeType: AssignmentChangeType,
  assignment: Pick<AssignmentDetail, 'effectiveStartDate' | 'effectiveEndDate'> | null | undefined,
  currentDate: string
): Readonly<{ minDate: string; maxDate: string | null }> {
  if (changeType !== 'CORRECTION' || !assignment) {
    return { minDate: currentDate, maxDate: null };
  }
  return {
    minDate: assignment.effectiveStartDate,
    maxDate:
      assignment.effectiveEndDate && assignment.effectiveEndDate < currentDate
        ? assignment.effectiveEndDate
        : currentDate,
  };
}

export function assignmentProposalAllowedChangeTypes(
  assignment: Pick<AssignmentDetail, 'effectiveStartDate' | 'effectiveEndDate'> | null | undefined,
  currentDate: string
): readonly AssignmentChangeType[] {
  if (
    assignment &&
    assignment.effectiveStartDate <= currentDate &&
    (!assignment.effectiveEndDate || assignment.effectiveEndDate >= currentDate)
  ) {
    return ASSIGNMENT_CHANGE_TYPES;
  }
  return CORRECTION_ONLY_CHANGE_TYPES;
}

export function buildCreateAssignmentProposalRequest(
  assignment: Pick<
    AssignmentDetail,
    'assignmentId' | 'assignmentVersion' | 'effectiveStartDate' | 'effectiveEndDate'
  >,
  draft: AssignmentProposalDraft,
  commandId: string,
  currentDate: string
): CreateAssignmentProposalRequest {
  if (!assignmentProposalAllowedChangeTypes(assignment, currentDate).includes(draft.changeType)) {
    throw new Error('Prospective changes require an assignment slice that includes today.');
  }
  const reasonCode = draft.reasonCode.trim();
  const value = draft.changeValue.trim();
  if (!reasonCode || !value || !draft.effectiveDate) {
    throw new Error('Assignment proposal draft is incomplete.');
  }
  return {
    commandId,
    targetAssignmentId: assignment.assignmentId,
    changeType: draft.changeType,
    effectiveDate: draft.effectiveDate,
    reasonCode,
    proposedChanges: { [assignmentProposalChangedField(draft.changeType)]: value },
    expectedAssignmentVersion: assignment.assignmentVersion,
  };
}

export function assignmentProposalDraftIsComplete(draft: AssignmentProposalDraft): boolean {
  const value = draft.changeValue.trim();
  if (!draft.effectiveDate || !draft.reasonCode.trim() || !value) return false;
  if (draft.changeType === 'CORRECTION') return value.length <= 240;
  if (
    draft.changeType === 'PROMOTION' ||
    draft.changeType === 'DEMOTION' ||
    draft.changeType === 'CHANGE_LOCATION'
  ) {
    return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(value);
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
}

export function assignmentProposalCanValidate(
  proposal: Pick<AssignmentProposal, 'lifecycleState'>
): boolean {
  return proposal.lifecycleState === 'DRAFT';
}

export function assignmentProposalCanSubmit(
  proposal: Pick<AssignmentProposal, 'lifecycleState' | 'validationFindings'>
): boolean {
  return (
    proposal.lifecycleState === 'VALIDATED' && !assignmentProposalHasBlockingFindings(proposal)
  );
}

export function assignmentProposalCanCancel(
  proposal: Pick<AssignmentProposal, 'lifecycleState'>
): boolean {
  return proposal.lifecycleState !== 'CANCELLED';
}
