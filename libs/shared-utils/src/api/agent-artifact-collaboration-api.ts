import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import { assertAgentRevision, assertAgentUuid } from './agent-governed-api';
import {
  parseDwaionTeamArtifactCapabilities,
  parseDwaionTeamArtifactEditResult,
  parseDwaionTeamArtifactPreflight,
  parseDwaionTeamArtifactShare,
  parseDwaionTeamArtifactWorkspace,
} from './agent-artifact-collaboration-parser';
import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';
import type {
  DwaionArtifactCollaborationCommand,
  DwaionArtifactCollaborationHighRiskCommand,
  DwaionTeamArtifactConflictResolution,
  DwaionTeamArtifactEditResult,
  DwaionTeamArtifactPreflight,
  DwaionTeamArtifactShare,
  DwaionTeamArtifactSharePermission,
  DwaionTeamArtifactWorkspace,
  RunDwaionTeamArtifactPreflightInput,
} from './agent-artifact-collaboration-contract';
import type { DwaionArtifactDraftContent } from './agent-artifact-api';

export type * from './agent-artifact-collaboration-contract';

const BASE = '/api/agent/v1/artifact-collaboration';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

export async function getDwaionTeamArtifactCapabilities(signal?: AbortSignal) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${BASE}/capabilities`, {
    signal,
  });
  return parseDwaionTeamArtifactCapabilities(response.data.data);
}

export async function getDwaionTeamArtifactWorkspace(
  artifactId: string,
  signal?: AbortSignal
): Promise<DwaionTeamArtifactWorkspace | null> {
  const path = artifactPath(artifactId);
  try {
    const response = await axiosInstance.get<ApiResponse<unknown>>(`${path}/workspace`, { signal });
    const workspace = parseDwaionTeamArtifactWorkspace(response.data.data);
    assertBinding(workspace.artifactId === artifactId, 'workspace');
    return workspace;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function runDwaionTeamArtifactPreflight(
  artifactId: string,
  input: RunDwaionTeamArtifactPreflightInput
): Promise<DwaionTeamArtifactPreflight> {
  validateCommand(input, false);
  assertAgentUuid(input.teamId, 'Artifact collaboration team identifier');
  assertAgentRevision(input.artifactRevision, 'Artifact revision', 1);
  if (input.members.length < 1 || input.members.length > 100)
    throw new TypeError('Artifact collaboration members are invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/preflights`,
    {
      ...commandBody(input),
      teamId: input.teamId,
      artifactRevision: input.artifactRevision,
      members: input.members,
      sources: input.sources,
      excludeInaccessibleSources: input.excludeInaccessibleSources,
    },
    productSurfaceGovernedMutationConfig(input.authority ?? LEGACY_AUTHORITY)
  );
  const preflight = parseDwaionTeamArtifactPreflight(response.data.data);
  assertBinding(
    preflight.artifactId === artifactId &&
      preflight.teamId === input.teamId &&
      preflight.artifactRevision === input.artifactRevision,
    'preflight'
  );
  return preflight;
}

export async function createDwaionTeamArtifactWorkspace(
  artifactId: string,
  teamId: string,
  preflightId: string,
  command: DwaionArtifactCollaborationHighRiskCommand
): Promise<DwaionTeamArtifactWorkspace> {
  validateCommand(command, true);
  assertAgentUuid(teamId, 'Artifact collaboration team identifier');
  assertAgentUuid(preflightId, 'Artifact collaboration preflight identifier');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace`,
    { ...commandBody(command), changeReason: command.changeReason.trim(), teamId, preflightId },
    highRiskConfig(command)
  );
  const workspace = parseDwaionTeamArtifactWorkspace(response.data.data);
  assertBinding(
    workspace.artifactId === artifactId && workspace.teamId === teamId,
    'workspace'
  );
  return workspace;
}

export async function updateDwaionTeamArtifactMembers(
  artifactId: string,
  preflightId: string,
  command: DwaionArtifactCollaborationHighRiskCommand
): Promise<DwaionTeamArtifactWorkspace> {
  validateCommand(command, true);
  assertAgentUuid(preflightId, 'Artifact collaboration preflight identifier');
  return mutateWorkspace(
    artifactId,
    'put',
    'members',
    { ...commandBody(command), changeReason: command.changeReason.trim(), preflightId },
    command
  );
}

export async function submitDwaionTeamArtifactEdit(
  artifactId: string,
  baseRevision: number,
  content: DwaionArtifactDraftContent,
  command: DwaionArtifactCollaborationCommand
): Promise<DwaionTeamArtifactEditResult> {
  validateCommand(command, false);
  assertAgentRevision(baseRevision, 'Artifact collaboration base revision', 1);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace/edits`,
    { ...commandBody(command), baseRevision, content },
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  const result = parseDwaionTeamArtifactEditResult(response.data.data);
  assertBinding(result.workspace.artifactId === artifactId, 'edit');
  return result;
}

export async function resolveDwaionTeamArtifactConflict(
  artifactId: string,
  conflictId: string,
  resolution: DwaionTeamArtifactConflictResolution,
  mergedContent: DwaionArtifactDraftContent | null,
  command: DwaionArtifactCollaborationHighRiskCommand
): Promise<DwaionTeamArtifactWorkspace> {
  validateCommand(command, true);
  assertAgentUuid(conflictId, 'Artifact collaboration conflict identifier');
  if ((resolution === 'MERGE') !== (mergedContent !== null))
    throw new TypeError('Merged content must be supplied only for MERGE.');
  return mutateWorkspace(
    artifactId,
    'post',
    `conflicts/${encodeURIComponent(conflictId)}/resolve`,
    {
      ...commandBody(command),
      changeReason: command.changeReason.trim(),
      resolution,
      mergedContent,
    },
    command
  );
}

export async function createDwaionTeamArtifactShare(
  artifactId: string,
  preflightId: string,
  permission: DwaionTeamArtifactSharePermission,
  expiresAt: string,
  command: DwaionArtifactCollaborationHighRiskCommand
): Promise<DwaionTeamArtifactShare> {
  validateCommand(command, true);
  assertAgentUuid(preflightId, 'Artifact collaboration preflight identifier');
  if (Number.isNaN(Date.parse(expiresAt))) throw new TypeError('Share expiry is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace/shares`,
    {
      ...commandBody(command),
      changeReason: command.changeReason.trim(),
      preflightId,
      permission,
      expiresAt,
    },
    highRiskConfig(command)
  );
  const share = parseDwaionTeamArtifactShare(response.data.data);
  return share;
}

export async function revokeDwaionTeamArtifactShare(
  artifactId: string,
  shareId: string,
  command: DwaionArtifactCollaborationHighRiskCommand
): Promise<DwaionTeamArtifactShare> {
  validateCommand(command, true);
  assertAgentUuid(shareId, 'Artifact collaboration share identifier');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace/shares/${encodeURIComponent(shareId)}/revoke`,
    { ...commandBody(command), changeReason: command.changeReason.trim() },
    highRiskConfig(command)
  );
  const share = parseDwaionTeamArtifactShare(response.data.data);
  assertBinding(share.shareId === shareId, 'share revocation');
  return share;
}

async function mutateWorkspace(
  artifactId: string,
  method: 'post' | 'put',
  suffix: string,
  body: object,
  command: DwaionArtifactCollaborationHighRiskCommand
) {
  const url = `${artifactPath(artifactId)}/workspace/${suffix}`;
  const response =
    method === 'post'
      ? await axiosInstance.post<ApiResponse<unknown>, object>(url, body, highRiskConfig(command))
      : await axiosInstance.put<ApiResponse<unknown>, object>(url, body, highRiskConfig(command));
  const workspace = parseDwaionTeamArtifactWorkspace(response.data.data);
  assertBinding(workspace.artifactId === artifactId, 'workspace');
  return workspace;
}

function validateCommand(
  command: DwaionArtifactCollaborationCommand,
  highRisk: boolean
): void {
  assertAgentUuid(command.commandId, 'Artifact collaboration command identifier');
  assertAgentRevision(command.expectedRevision, 'Artifact collaboration command revision');
  if (!/^[A-Z][A-Z0-9_.-]{1,63}$/u.test(command.reasonCode))
    throw new TypeError('Artifact collaboration reason code is invalid.');
  if (
    highRisk &&
    (!('changeReason' in command) ||
      typeof command.changeReason !== 'string' ||
      command.changeReason.trim().length < 5)
  )
    throw new TypeError('Artifact collaboration change reason is required.');
}

function commandBody(command: DwaionArtifactCollaborationCommand) {
  return {
    commandId: command.commandId,
    expectedRevision: command.expectedRevision,
    reasonCode: command.reasonCode,
  };
}

function highRiskConfig(command: DwaionArtifactCollaborationHighRiskCommand) {
  return productSurfaceHighRiskMutationConfig(command.authority ?? LEGACY_AUTHORITY, {
    objectVersionHeader: true,
  });
}

function artifactPath(artifactId: string) {
  assertAgentUuid(artifactId, 'Artifact identifier');
  return `${BASE}/${encodeURIComponent(artifactId)}`;
}

function assertBinding(condition: boolean, label: string): asserts condition {
  if (!condition) throw new HttpError(`Artifact collaboration ${label} binding is invalid.`, 502);
}

export function newDwaionArtifactCollaborationCommandId(): string {
  return crypto.randomUUID();
}
