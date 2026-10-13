import {
  ASSIGNMENT_CHANGE_TYPES,
  HttpError,
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type {
  AssignmentChangeType,
  AssignmentDetail,
  AssignmentProposal,
  CreateAssignmentProposalRequest,
  ProductSurfaceGovernedMutationAuthority,
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

export const EMPLOYMENT_EVENT_ROUTE_BINDINGS = {
  create: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-create.action',
    taskKind: 'OPERATIONS',
  },
  validate: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-validate.action',
    taskKind: 'OPERATIONS',
  },
  submit: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-submit.action',
    taskKind: 'OPERATIONS',
  },
  publish: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-publish.action',
    taskKind: 'OPERATIONS',
  },
} as const;

export const EMPLOYMENT_EVENT_BASE_PATH = '/api/people/v1/hris/assignment-events' as const;
export const EMPLOYMENT_EVENT_RECEIPT_PATH = '/api/people/v1/hris/command-receipts' as const;
export const EMPLOYMENT_EVENT_PURPOSE = 'HR_LIFECYCLE' as const;
export const EMPLOYMENT_EVENT_API_CONTRACTS = [
  {
    bindingId: 'PEP-HRM-006',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.create.routeContractKey,
    method: 'POST',
    path: EMPLOYMENT_EVENT_BASE_PATH,
  },
  {
    bindingId: 'PEP-HRM-007',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.validate.routeContractKey,
    method: 'POST',
    path: `${EMPLOYMENT_EVENT_BASE_PATH}/{eventPublicId}/validate`,
  },
  {
    bindingId: 'PEP-HRM-008',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.submit.routeContractKey,
    method: 'POST',
    path: `${EMPLOYMENT_EVENT_BASE_PATH}/{eventPublicId}/submit`,
  },
  {
    bindingId: 'PEP-HRM-009',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.publish.routeContractKey,
    method: 'POST',
    path: `${EMPLOYMENT_EVENT_BASE_PATH}/{eventPublicId}/publish`,
  },
] as const;

export type EmploymentEventType = 'HIRE' | 'CONCURRENT_EMPLOYMENT';
export type EmploymentType = 'EMPLOYEE' | 'CONTINGENT' | 'INTERN' | 'APPRENTICE';
export type EmploymentEventLifecycle =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'SUPERSEDED';

export type EmploymentOwnerRef = Readonly<{
  owner: 'HRM';
  schemaId: string;
  publicId: string;
  revision: number;
  contentHash: string;
}>;

export type EmploymentAssignmentDraft = Readonly<{
  organizationRef: EmploymentOwnerRef;
  positionRef: EmploymentOwnerRef;
  jobRef: EmploymentOwnerRef;
  workLocationRef: EmploymentOwnerRef;
  validFrom: string;
  validToExclusive: string | null;
  primary: boolean;
  fte: string;
}>;

export type EmploymentEventCommandContext = Readonly<{
  expectedVersion: number;
  idempotencyKey: string;
  purpose: typeof EMPLOYMENT_EVENT_PURPOSE;
  effectiveAt: string;
}>;

export type HireEmploymentEventCommand = Readonly<{
  context: EmploymentEventCommandContext;
  eventType: 'HIRE';
  payload: Readonly<{
    personPublicId: string;
    legalEmployerRef: EmploymentOwnerRef;
    employmentType: EmploymentType;
    relationshipStart: string;
    workerCreation: 'CREATE_NEW';
    assignment: EmploymentAssignmentDraft;
  }>;
}>;

export type ConcurrentEmploymentEventCommand = Readonly<{
  context: EmploymentEventCommandContext;
  eventType: 'CONCURRENT_EMPLOYMENT';
  payload: Readonly<{
    workerPublicId: string;
    expectedWorkerVersion: number;
    legalEmployerRef: EmploymentOwnerRef;
    relationshipStart: string;
    assignment: EmploymentAssignmentDraft;
  }>;
}>;

export type EmploymentEventCommand =
  | HireEmploymentEventCommand
  | ConcurrentEmploymentEventCommand;

export type EmploymentEventCommandReceiptStatus =
  | 'ACCEPTED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'REJECTED'
  | 'FAILED'
  | 'RESULT_UNKNOWN';

export type EmploymentEventCommandReceipt = Readonly<{
  receiptId: string;
  commandType: string;
  originatingAction: string;
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: typeof EMPLOYMENT_EVENT_PURPOSE;
  authorizationRevision: number;
  status: EmploymentEventCommandReceiptStatus;
  correlationId: string;
  requestDigest: string;
  createdAt: string;
}>;

export type EmploymentEventCommandResult = Readonly<{
  receipt: EmploymentEventCommandReceipt;
  eventPublicId: string;
  lifecycleState: EmploymentEventLifecycle;
  version: number;
}>;

export type EmploymentEventImpact = Readonly<{
  eventPublicId: string;
  effectiveDate: string;
  blockingIssues: readonly string[];
  warnings: readonly string[];
  impactDigest: string;
}>;

export type EmploymentEventImpactResult = Readonly<{
  impact: EmploymentEventImpact;
  eventPublicId: string;
  lifecycleState: 'VALIDATED';
  version: 1;
}>;

export type EmploymentEventSnapshotResult = Readonly<{
  event: unknown;
  eventPublicId: string;
  lifecycleState: EmploymentEventLifecycle;
  version: number;
}>;

export type EmploymentEventLifecycleCommand = Readonly<{
  eventPublicId: string;
  expectedVersion: number;
  idempotencyKey: string;
  correlationId: string;
}>;

export type EmploymentEventFailureKind =
  | 'PRIMARY_OVERLAP'
  | 'STALE_VERSION'
  | 'DENIED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID'
  | 'RESULT_UNKNOWN'
  | 'UNAVAILABLE';

export type EmploymentEventFailure = Readonly<{
  kind: EmploymentEventFailureKind;
  code: string | null;
  currentVersion: number | null;
  receiptId: string | null;
  correlationId: string | null;
  retryable: boolean;
}>;

export type AssignmentProposalSelection =
  | Readonly<{ kind: 'create'; assignmentId: string }>
  | Readonly<{ kind: 'proposal'; proposalId: string }>
  | Readonly<{
      kind: 'employment-create';
      eventType: EmploymentEventType;
      subjectPublicId: string;
      expectedVersion: number;
    }>;

export type AssignmentProposalDraft = Readonly<{
  changeType: AssignmentChangeType;
  effectiveDate: string;
  reasonCode: string;
  changeValue: string;
}>;

export type AssignmentProposalFailureKind = 'DENIED' | 'CONFLICT' | 'INVALID' | 'UNAVAILABLE';

const LEGACY_ASSIGNMENT_MANAGERS = new Set(['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN']);

const CREATE_PREFIX = 'new:';
const EMPLOYMENT_CREATE_PREFIX = 'employment:new:';
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/u;
const FTE_PATTERN = /^(?:0(?:\.\d{1,12})?|1(?:\.0{1,12})?)$/u;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const instant = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    instant.getUTCFullYear() === year &&
    instant.getUTCMonth() + 1 === month &&
    instant.getUTCDate() === day
  );
}

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && value.includes('T') && Number.isFinite(Date.parse(value));
}

function assertOwnerRef(value: EmploymentOwnerRef, field: string): void {
  if (
    value.owner !== 'HRM' ||
    !nonBlank(value.schemaId) ||
    !validUuid(value.publicId) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !SHA256_PATTERN.test(value.contentHash)
  ) {
    throw new Error(`${field} is not a canonical HRM owner reference.`);
  }
}

function assertAssignmentDraft(value: EmploymentAssignmentDraft, relationshipStart: string): void {
  assertOwnerRef(value.organizationRef, 'organizationRef');
  assertOwnerRef(value.positionRef, 'positionRef');
  assertOwnerRef(value.jobRef, 'jobRef');
  assertOwnerRef(value.workLocationRef, 'workLocationRef');
  if (
    !validCivilDate(value.validFrom) ||
    value.validFrom !== relationshipStart ||
    (value.validToExclusive !== null &&
      (!validCivilDate(value.validToExclusive) || value.validToExclusive <= value.validFrom)) ||
    !FTE_PATTERN.test(value.fte)
  ) {
    throw new Error('Assignment effective period or FTE is invalid.');
  }
}

export function assertEmploymentEventCommand(
  command: EmploymentEventCommand
): EmploymentEventCommand {
  const relationshipStart = command.payload.relationshipStart;
  if (
    !Number.isSafeInteger(command.context.expectedVersion) ||
    command.context.expectedVersion < 0 ||
    !IDEMPOTENCY_KEY_PATTERN.test(command.context.idempotencyKey) ||
    command.context.purpose !== EMPLOYMENT_EVENT_PURPOSE ||
    !validInstant(command.context.effectiveAt) ||
    !validCivilDate(relationshipStart) ||
    command.context.effectiveAt.slice(0, 10) !== relationshipStart
  ) {
    throw new Error('Employment event command context is invalid.');
  }
  assertOwnerRef(command.payload.legalEmployerRef, 'legalEmployerRef');
  assertAssignmentDraft(command.payload.assignment, relationshipStart);
  if (command.eventType === 'HIRE') {
    if (
      command.context.expectedVersion !== 0 ||
      !validUuid(command.payload.personPublicId) ||
      command.payload.workerCreation !== 'CREATE_NEW'
    ) {
      throw new Error('Hire command identity is invalid.');
    }
  } else if (
    !validUuid(command.payload.workerPublicId) ||
    !Number.isSafeInteger(command.payload.expectedWorkerVersion) ||
    command.payload.expectedWorkerVersion < 0 ||
    command.payload.expectedWorkerVersion !== command.context.expectedVersion
  ) {
    throw new Error('Concurrent-employment owner version is invalid.');
  }
  return command;
}

export function buildHireEmploymentEventCommand(
  input: Readonly<{
    idempotencyKey: string;
    effectiveAt: string;
    personPublicId: string;
    legalEmployerRef: EmploymentOwnerRef;
    employmentType: EmploymentType;
    relationshipStart: string;
    assignment: EmploymentAssignmentDraft;
  }>
): HireEmploymentEventCommand {
  return assertEmploymentEventCommand({
    context: {
      expectedVersion: 0,
      idempotencyKey: input.idempotencyKey,
      purpose: EMPLOYMENT_EVENT_PURPOSE,
      effectiveAt: input.effectiveAt,
    },
    eventType: 'HIRE',
    payload: {
      personPublicId: input.personPublicId,
      legalEmployerRef: input.legalEmployerRef,
      employmentType: input.employmentType,
      relationshipStart: input.relationshipStart,
      workerCreation: 'CREATE_NEW',
      assignment: input.assignment,
    },
  }) as HireEmploymentEventCommand;
}

export function buildConcurrentEmploymentEventCommand(
  input: Readonly<{
    idempotencyKey: string;
    effectiveAt: string;
    workerPublicId: string;
    expectedWorkerVersion: number;
    legalEmployerRef: EmploymentOwnerRef;
    relationshipStart: string;
    assignment: EmploymentAssignmentDraft;
  }>
): ConcurrentEmploymentEventCommand {
  return assertEmploymentEventCommand({
    context: {
      expectedVersion: input.expectedWorkerVersion,
      idempotencyKey: input.idempotencyKey,
      purpose: EMPLOYMENT_EVENT_PURPOSE,
      effectiveAt: input.effectiveAt,
    },
    eventType: 'CONCURRENT_EMPLOYMENT',
    payload: {
      workerPublicId: input.workerPublicId,
      expectedWorkerVersion: input.expectedWorkerVersion,
      legalEmployerRef: input.legalEmployerRef,
      relationshipStart: input.relationshipStart,
      assignment: input.assignment,
    },
  }) as ConcurrentEmploymentEventCommand;
}

export function employmentEventFailure(error: unknown): EmploymentEventFailure {
  const details = error instanceof HttpError ? record(error.details) : null;
  const codeValue = details?.code ?? details?.errorCode;
  const code = typeof codeValue === 'string' ? codeValue.trim().toUpperCase() : null;
  const currentVersion = Number.isSafeInteger(details?.currentVersion)
    ? (details!.currentVersion as number)
    : null;
  const receiptId = validUuid(details?.receiptId) ? details.receiptId : null;
  const correlationId = validUuid(details?.correlationId) ? details.correlationId : null;
  const retryable = details?.retryable === true;
  let kind: EmploymentEventFailureKind = 'UNAVAILABLE';
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403 || error.status === 404) kind = 'DENIED';
    else if (code === 'PRIMARY_ASSIGNMENT_OVERLAP') kind = 'PRIMARY_OVERLAP';
    else if (code === 'STALE_OWNER_VERSION' || code === 'OBJECT_VERSION_CONFLICT') {
      kind = 'STALE_VERSION';
    } else if (code === 'IDEMPOTENCY_CONFLICT' || code === 'IDEMPOTENCY_KEY_REUSED') {
      kind = 'IDEMPOTENCY_CONFLICT';
    }
    else if (error.status >= 500 && receiptId) kind = 'RESULT_UNKNOWN';
    else if (error.status === 400 || error.status === 409 || error.status === 422) kind = 'INVALID';
  }
  return { kind, code, currentVersion, receiptId, correlationId, retryable };
}

export function employmentEventReceiptDisposition(
  receipt: Pick<EmploymentEventCommandReceipt, 'status'>
): 'PENDING' | 'SUCCEEDED' | 'REJECTED' | 'RESULT_UNKNOWN' {
  if (receipt.status === 'ACCEPTED' || receipt.status === 'RUNNING') return 'PENDING';
  if (receipt.status === 'SUCCEEDED') return 'SUCCEEDED';
  if (receipt.status === 'RESULT_UNKNOWN') return 'RESULT_UNKNOWN';
  return 'REJECTED';
}

export function assignmentProposalCreateReference(assignmentId: string): string {
  return `${CREATE_PREFIX}${assignmentId}`;
}

export function employmentEventCreateReference(
  eventType: EmploymentEventType,
  subjectPublicId: string,
  expectedVersion: number
): string {
  return `${EMPLOYMENT_CREATE_PREFIX}${eventType}:${subjectPublicId}:${expectedVersion}`;
}

export function resolveAssignmentProposalSelection(
  value: string | null | undefined
): AssignmentProposalSelection | null {
  if (!nonBlank(value)) return null;
  if (value.startsWith(EMPLOYMENT_CREATE_PREFIX)) {
    const [eventType, subjectPublicId, version, ...unexpected] = value
      .slice(EMPLOYMENT_CREATE_PREFIX.length)
      .split(':');
    const expectedVersion = Number(version);
    if (
      unexpected.length ||
      (eventType !== 'HIRE' && eventType !== 'CONCURRENT_EMPLOYMENT') ||
      !nonBlank(subjectPublicId) ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0 ||
      (eventType === 'HIRE' && expectedVersion !== 0)
    ) {
      return null;
    }
    return { kind: 'employment-create', eventType, subjectPublicId, expectedVersion };
  }
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

const EMPLOYMENT_EVENT_RECEIPT_STATUSES = new Set<EmploymentEventCommandReceiptStatus>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const EMPLOYMENT_EVENT_LIFECYCLE_STATES = new Set<EmploymentEventLifecycle>([
  'DRAFT',
  'VALIDATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'CANCELLED',
  'SUPERSEDED',
]);

function requiredText(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Employment event response field ${field} is invalid.`);
  }
  return value;
}

export function parseEmploymentEventCommandReceipt(
  value: unknown
): EmploymentEventCommandReceipt {
  const source = record(value);
  if (!source) throw new Error('Employment event command receipt is invalid.');
  const receiptId = requiredText(source, 'receiptId');
  const subjectPrincipalPublicId = requiredText(source, 'subjectPrincipalPublicId');
  const populationScopeDigest = requiredText(source, 'populationScopeDigest');
  const purposeCode = requiredText(source, 'purposeCode');
  const status = requiredText(source, 'status');
  const correlationId = requiredText(source, 'correlationId');
  const requestDigest = requiredText(source, 'requestDigest');
  const createdAt = requiredText(source, 'createdAt');
  if (
    !validUuid(receiptId) ||
    !validUuid(subjectPrincipalPublicId) ||
    !SHA256_PATTERN.test(populationScopeDigest) ||
    !Number.isSafeInteger(source.fieldPolicyRevision) ||
    (source.fieldPolicyRevision as number) < 1 ||
    purposeCode !== EMPLOYMENT_EVENT_PURPOSE ||
    !Number.isSafeInteger(source.authorizationRevision) ||
    (source.authorizationRevision as number) < 1 ||
    !EMPLOYMENT_EVENT_RECEIPT_STATUSES.has(status as EmploymentEventCommandReceiptStatus) ||
    !validUuid(correlationId) ||
    !SHA256_PATTERN.test(requestDigest) ||
    !validInstant(createdAt)
  ) {
    throw new Error('Employment event command receipt is invalid.');
  }
  return {
    receiptId,
    commandType: requiredText(source, 'commandType'),
    originatingAction: requiredText(source, 'originatingAction'),
    subjectPrincipalPublicId,
    populationScopeDigest,
    fieldPolicyRevision: source.fieldPolicyRevision as number,
    purposeCode: EMPLOYMENT_EVENT_PURPOSE,
    authorizationRevision: source.authorizationRevision as number,
    status: status as EmploymentEventCommandReceiptStatus,
    correlationId,
    requestDigest,
    createdAt,
  };
}

function responseVersion(headers: Headers | undefined): number {
  const etag = headers?.get('ETag') ?? '';
  const versionMatch = /^"v:(\d+)"$/u.exec(etag);
  const version = versionMatch ? Number(versionMatch[1]) : Number.NaN;
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error('Employment event response version is invalid.');
  }
  return version;
}

function locationEventPublicId(headers: Headers | undefined): string {
  const location = headers?.get('Location') ?? '';
  let eventPublicId = '';
  try {
    const pathname = new URL(location, 'https://dwp.invalid').pathname;
    eventPublicId = pathname.split('/').filter(Boolean).at(-1) ?? '';
  } catch {
    eventPublicId = '';
  }
  if (!validUuid(eventPublicId)) throw new Error('Employment event response identity is invalid.');
  return eventPublicId;
}

function commandHeaders(
  idempotencyKey: string,
  expectedVersion: number,
  correlationId: string
): Record<string, string> {
  if (
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    !validUuid(correlationId)
  ) {
    throw new Error('Employment event command transport identity is invalid.');
  }
  return {
    'Idempotency-Key': idempotencyKey,
    'If-Match': `"v:${expectedVersion}"`,
    'X-Correlation-ID': correlationId,
    'X-Purpose-Code': EMPLOYMENT_EVENT_PURPOSE,
  };
}

function employmentEventMutationConfig(
  authority: ProductSurfaceGovernedMutationAuthority,
  command: Pick<EmploymentEventLifecycleCommand, 'expectedVersion' | 'idempotencyKey' | 'correlationId'>,
  highRisk = false
) {
  if (
    authority.mode === 'SECURE' &&
    ((authority.idempotencyKey !== undefined &&
      authority.idempotencyKey !== command.idempotencyKey) ||
      (highRisk && authority.objectVersion !== command.expectedVersion))
  ) {
    throw new Error('Employment event route authority does not match the command.');
  }
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
    : productSurfaceGovernedMutationConfig(authority);
  return {
    ...governed,
    headers: {
      ...governed.headers,
      ...commandHeaders(command.idempotencyKey, command.expectedVersion, command.correlationId),
    },
    csrfReplay: 'NEVER' as const,
  };
}

function commandResult(
  value: unknown,
  headers: Headers | undefined,
  correlationId: string,
  eventPublicId: string,
  lifecycleState: EmploymentEventLifecycle,
  version: number
): EmploymentEventCommandResult {
  const receipt = parseEmploymentEventCommandReceipt(value);
  if (
    receipt.correlationId !== correlationId ||
    !validUuid(eventPublicId) ||
    responseVersion(headers) !== version
  ) {
    throw new Error('Employment event command result does not match the request.');
  }
  return { receipt, eventPublicId, lifecycleState, version };
}

export async function createEmploymentEvent(
  command: EmploymentEventCommand,
  correlationId: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmploymentEventCommandResult> {
  assertEmploymentEventCommand(command);
  const response = await axiosInstance.post<unknown, EmploymentEventCommand>(
    EMPLOYMENT_EVENT_BASE_PATH,
    command,
    employmentEventMutationConfig(
      authority,
      {
        expectedVersion: command.context.expectedVersion,
        idempotencyKey: command.context.idempotencyKey,
        correlationId,
      },
      false
    )
  );
  return commandResult(
    response.data,
    response.headers,
    correlationId,
    locationEventPublicId(response.headers),
    'DRAFT',
    0
  );
}

function lifecyclePath(command: EmploymentEventLifecycleCommand, action: string): string {
  if (!validUuid(command.eventPublicId)) {
    throw new Error('Employment event public identity is invalid.');
  }
  return `${EMPLOYMENT_EVENT_BASE_PATH}/${encodeURIComponent(command.eventPublicId)}/${action}`;
}

export async function validateEmploymentEvent(
  command: EmploymentEventLifecycleCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmploymentEventImpactResult> {
  const response = await axiosInstance.post<unknown, Record<string, never>>(
    lifecyclePath(command, 'validate'),
    {},
    employmentEventMutationConfig(authority, command)
  );
  const version = responseVersion(response.headers);
  const source = record(response.data);
  if (!source) throw new Error('Employment event impact is invalid.');
  const eventPublicId = requiredText(source, 'eventPublicId');
  const effectiveDate = requiredText(source, 'effectiveDate');
  const impactDigest = requiredText(source, 'impactDigest');
  const blockingIssues = source.blockingIssues;
  const warnings = source.warnings;
  if (
    !validUuid(eventPublicId) ||
    !validCivilDate(effectiveDate) ||
    !SHA256_PATTERN.test(impactDigest) ||
    !Array.isArray(blockingIssues) ||
    !blockingIssues.every((issue) => typeof issue === 'string') ||
    !Array.isArray(warnings) ||
    !warnings.every((warning) => typeof warning === 'string') ||
    eventPublicId !== command.eventPublicId ||
    version !== 1
  ) {
    throw new Error('Employment event impact does not match the request.');
  }
  return {
    impact: { eventPublicId, effectiveDate, impactDigest, blockingIssues, warnings },
    eventPublicId,
    lifecycleState: 'VALIDATED',
    version: 1,
  };
}

async function executeEmploymentEventLifecycle(
  command: EmploymentEventLifecycleCommand,
  action: 'submit' | 'publish',
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmploymentEventCommandResult> {
  const highRisk = action === 'publish';
  const response = await axiosInstance.post<unknown, Record<string, never>>(
    lifecyclePath(command, action),
    {},
    employmentEventMutationConfig(authority, command, highRisk)
  );
  return commandResult(
    response.data,
    response.headers,
    command.correlationId,
    command.eventPublicId,
    action === 'submit' ? 'PENDING_APPROVAL' : 'PUBLISHED',
    action === 'submit' ? 2 : 4
  );
}

export function submitEmploymentEvent(
  command: EmploymentEventLifecycleCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmploymentEventCommandResult> {
  return executeEmploymentEventLifecycle(command, 'submit', authority);
}

export function publishEmploymentEvent(
  command: EmploymentEventLifecycleCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<EmploymentEventCommandResult> {
  if (command.expectedVersion !== 3) {
    throw new Error('Only an approved employment event at version 3 can be published.');
  }
  return executeEmploymentEventLifecycle(command, 'publish', authority);
}

export async function getEmploymentEvent(
  eventPublicId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<EmploymentEventSnapshotResult> {
  if (!validUuid(eventPublicId)) throw new Error('Employment event public identity is invalid.');
  const response = await axiosInstance.get<unknown>(
    `${EMPLOYMENT_EVENT_BASE_PATH}/${encodeURIComponent(eventPublicId)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  const source = record(response.data);
  if (!source) throw new Error('Employment event snapshot is invalid.');
  const responseEventPublicId = requiredText(source, 'eventPublicId');
  const lifecycleState = requiredText(source, 'lifecycleState');
  const version = source.version;
  if (
    responseEventPublicId !== eventPublicId ||
    !EMPLOYMENT_EVENT_LIFECYCLE_STATES.has(lifecycleState as EmploymentEventLifecycle) ||
    !Number.isSafeInteger(version) ||
    (version as number) < 0 ||
    responseVersion(response.headers) !== version
  ) {
    throw new Error('Employment event snapshot does not match the request.');
  }
  return {
    event: response.data,
    eventPublicId,
    lifecycleState: lifecycleState as EmploymentEventLifecycle,
    version: version as number,
  };
}

export async function getEmploymentEventCommandReceipt(
  receiptId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<EmploymentEventCommandReceipt> {
  if (!validUuid(receiptId)) throw new Error('Employment event receipt identity is invalid.');
  const response = await axiosInstance.get<unknown>(
    `${EMPLOYMENT_EVENT_RECEIPT_PATH}/${encodeURIComponent(receiptId)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  const receipt = parseEmploymentEventCommandReceipt(response.data);
  if (receipt.receiptId !== receiptId) {
    throw new Error('Employment event receipt does not match the request.');
  }
  if (responseVersion(response.headers) !== 0) {
    throw new Error('Employment event receipt response version is invalid.');
  }
  return receipt;
}
