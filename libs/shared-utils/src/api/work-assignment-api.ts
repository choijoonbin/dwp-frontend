import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import type {
  CreateWorkAssignmentInput,
  ReassignWorkAssignmentInput,
  WorkAssignmentEventPage,
  WorkAssignmentMutationResult,
  WorkAssignmentScope,
  WorkAssignmentSourceIdentity,
  WorkAssignmentTask,
  WorkAssignmentTaskPage,
  WorkAssignmentTransition,
  WorkAssignmentVersionCommand,
} from './work-assignment-contracts';

const base = '/api/platform/v1/workspace/work-hub/assignments';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const reasonCode = /^[A-Z][A-Z0-9_]{2,47}$/u;
const transitions: readonly WorkAssignmentTransition[] = [
  'accept',
  'decline',
  'start',
  'wait',
  'complete',
  'cancel',
];

function requireUuid(value: string) {
  if (!uuid.test(value)) throw new Error('A canonical UUID identifier is required.');
  return value;
}

function requireInteger(value: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error('Work assignment numeric input is out of range.');
  return value;
}

function sourceIdentity(source: WorkAssignmentSourceIdentity): WorkAssignmentSourceIdentity {
  if (source.sourceSystem !== 'MEETING_FOLLOWUP')
    throw new Error('A Meeting follow-up source is required.');
  return {
    sourceSystem: source.sourceSystem,
    meetingId: requireUuid(source.meetingId),
    reportId: requireUuid(source.reportId),
    candidateId: requireUuid(source.candidateId),
  };
}

function versionCommand(input: WorkAssignmentVersionCommand): WorkAssignmentVersionCommand {
  if (input.reasonCode != null && !reasonCode.test(input.reasonCode))
    throw new Error('A valid Work assignment reason code is required.');
  return {
    version: requireInteger(input.version, 0),
    assignmentRevision: requireInteger(input.assignmentRevision, 0),
    ...(input.reasonCode !== undefined ? { reasonCode: input.reasonCode } : {}),
  };
}

function commandConfig(commandId: string) {
  return { headers: { 'Idempotency-Key': requireUuid(commandId) } };
}

export async function getWorkAssignments(
  options: { scope?: WorkAssignmentScope; page?: number; size?: number } = {}
): Promise<WorkAssignmentTaskPage> {
  const scope = options.scope ?? 'ASSIGNED_TO_ME';
  if (!['ASSIGNED_TO_ME', 'ASSIGNED_BY_ME'].includes(scope))
    throw new Error('An explicit Work assignment scope is required.');
  const params = new URLSearchParams({
    scope,
    page: String(requireInteger(options.page ?? 0, 0, 10_000)),
    size: String(requireInteger(options.size ?? 50, 1, 100)),
  });
  return (await axiosInstance.get<ApiResponse<WorkAssignmentTaskPage>>(`${base}?${params}`)).data
    .data;
}

export async function getWorkAssignment(assignmentId: string): Promise<WorkAssignmentTask> {
  return (
    await axiosInstance.get<ApiResponse<WorkAssignmentTask>>(`${base}/${requireUuid(assignmentId)}`)
  ).data.data;
}

/** A failed owner read, including 404, remains an error rather than an inferred empty task. */
export async function getWorkAssignmentBySource(
  source: WorkAssignmentSourceIdentity
): Promise<WorkAssignmentTask> {
  const identity = sourceIdentity(source);
  const params = new URLSearchParams({
    meetingId: identity.meetingId,
    reportId: identity.reportId,
    candidateId: identity.candidateId,
  });
  return (await axiosInstance.get<ApiResponse<WorkAssignmentTask>>(`${base}/by-source?${params}`))
    .data.data;
}

/** Use the original command ID to resolve a response that was lost after the server committed. */
export async function getWorkAssignmentCommand(
  commandId: string
): Promise<WorkAssignmentMutationResult> {
  return (
    await axiosInstance.get<ApiResponse<WorkAssignmentMutationResult>>(
      `${base}/commands/${requireUuid(commandId)}`
    )
  ).data.data;
}

export async function getWorkAssignmentEvents(
  assignmentId: string,
  options: { afterVersion?: number; size?: number } = {}
): Promise<WorkAssignmentEventPage> {
  const path = `${base}/${requireUuid(assignmentId)}/events`;
  const params = new URLSearchParams({
    afterVersion: String(requireInteger(options.afterVersion ?? -1, -1)),
    size: String(requireInteger(options.size ?? 100, 1, 100)),
  });
  return (await axiosInstance.get<ApiResponse<WorkAssignmentEventPage>>(`${path}?${params}`)).data
    .data;
}

export async function createWorkAssignment(
  input: CreateWorkAssignmentInput,
  commandId: string
): Promise<WorkAssignmentMutationResult> {
  const body: CreateWorkAssignmentInput = {
    source: sourceIdentity(input.source),
    expectedSourceVersion: requireInteger(input.expectedSourceVersion, 0),
  };
  return (
    await axiosInstance.post<ApiResponse<WorkAssignmentMutationResult>, CreateWorkAssignmentInput>(
      base,
      body,
      commandConfig(commandId)
    )
  ).data.data;
}

/** Keep the same body and command ID on uncertain retries; accept never implies start. */
export async function transitionWorkAssignment(
  assignmentId: string,
  transition: WorkAssignmentTransition,
  input: WorkAssignmentVersionCommand,
  commandId: string
): Promise<WorkAssignmentMutationResult> {
  if (!transitions.includes(transition))
    throw new Error('An explicit assignment command is required.');
  const path = `${base}/${requireUuid(assignmentId)}/${transition}`;
  return (
    await axiosInstance.post<
      ApiResponse<WorkAssignmentMutationResult>,
      WorkAssignmentVersionCommand
    >(path, versionCommand(input), commandConfig(commandId))
  ).data.data;
}

export async function reassignWorkAssignment(
  assignmentId: string,
  input: ReassignWorkAssignmentInput,
  commandId: string
): Promise<WorkAssignmentMutationResult> {
  if (!reasonCode.test(input.reasonCode))
    throw new Error('Reassignment requires a valid reason code.');
  const body: ReassignWorkAssignmentInput = {
    version: requireInteger(input.version, 0),
    assignmentRevision: requireInteger(input.assignmentRevision, 0),
    assigneeUserId: requireInteger(input.assigneeUserId, 1),
    reasonCode: input.reasonCode,
  };
  return (
    await axiosInstance.post<
      ApiResponse<WorkAssignmentMutationResult>,
      ReassignWorkAssignmentInput
    >(`${base}/${requireUuid(assignmentId)}/reassign`, body, commandConfig(commandId))
  ).data.data;
}
