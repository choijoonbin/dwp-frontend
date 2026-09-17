import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import {
  assertAgentRevision,
  assertAgentUuid,
  isAgentDate,
  isAgentRecord,
} from './agent-governed-api';
import {
  parseDwaionTeamArtifactCapabilities,
  parseDwaionTeamArtifactAccessRequest,
  parseDwaionTeamArtifactComment,
  parseDwaionTeamArtifactComments,
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
  DecideDwaionTeamArtifactReviewStageInput,
  ExecuteDwaionTeamArtifactRemediationInput,
  DwaionTeamArtifactConflictResolution,
  DwaionTeamArtifactComment,
  DwaionTeamArtifactAccessRequest,
  DwaionTeamArtifactEditResult,
  DwaionTeamArtifactPreflight,
  DwaionTeamArtifactShare,
  DwaionTeamArtifactSharePermission,
  DwaionTeamArtifactWorkspace,
  DwaionTeamArtifactRemediationReceipt,
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

export async function getDwaionTeamArtifactComments(
  artifactId: string,
  signal?: AbortSignal
): Promise<DwaionTeamArtifactComment[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${artifactPath(artifactId)}/workspace/comments`,
    { signal }
  );
  const comments = parseDwaionTeamArtifactComments(response.data.data);
  assertBinding(
    comments.every((comment) => comment.artifactId === artifactId),
    'comments'
  );
  return comments;
}

export async function createDwaionTeamArtifactComment(
  artifactId: string,
  body: string,
  anchor: string | null,
  command: DwaionArtifactCollaborationCommand
): Promise<DwaionTeamArtifactComment> {
  validateCommand(command, false);
  validateCommentBody(body);
  if (anchor !== null && anchor.length > 1_000)
    throw new TypeError('Artifact comment anchor is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace/comments`,
    { ...commandBody(command), body: body.trim(), anchor: anchor?.trim() || null },
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  const comment = parseDwaionTeamArtifactComment(response.data.data);
  assertBinding(comment.artifactId === artifactId, 'comment');
  return comment;
}

export async function replyDwaionTeamArtifactComment(
  artifactId: string,
  commentId: string,
  body: string,
  command: DwaionArtifactCollaborationCommand
): Promise<DwaionTeamArtifactComment> {
  validateCommand(command, false);
  assertAgentUuid(commentId, 'Artifact comment identifier');
  validateCommentBody(body);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace/comments/${encodeURIComponent(commentId)}/replies`,
    { ...commandBody(command), body: body.trim() },
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  const comment = parseDwaionTeamArtifactComment(response.data.data);
  assertBinding(
    comment.artifactId === artifactId && comment.commentId === commentId,
    'comment reply'
  );
  return comment;
}

export async function resolveDwaionTeamArtifactComment(
  artifactId: string,
  commentId: string,
  command: DwaionArtifactCollaborationHighRiskCommand
): Promise<DwaionTeamArtifactComment> {
  validateCommand(command, true);
  assertAgentUuid(commentId, 'Artifact comment identifier');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace/comments/${encodeURIComponent(commentId)}/resolve`,
    { ...commandBody(command), changeReason: command.changeReason.trim() },
    highRiskConfig(command)
  );
  const comment = parseDwaionTeamArtifactComment(response.data.data);
  assertBinding(
    comment.artifactId === artifactId && comment.commentId === commentId,
    'comment resolution'
  );
  return comment;
}

export async function decideDwaionTeamArtifactReviewStage(
  artifactId: string,
  stageId: string,
  input: DecideDwaionTeamArtifactReviewStageInput
): Promise<DwaionTeamArtifactWorkspace> {
  validateCommand(input, true);
  assertAgentUuid(stageId, 'Artifact review stage identifier');
  if (!['APPROVE', 'REJECT'].includes(input.decision)) {
    throw new TypeError('Artifact review decision is invalid.');
  }
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/workspace/review-stages/${encodeURIComponent(stageId)}/decision`,
    {
      ...commandBody(input),
      changeReason: input.changeReason.trim(),
      decision: input.decision,
    },
    highRiskConfig(input)
  );
  const workspace = parseDwaionTeamArtifactWorkspace(response.data.data);
  assertBinding(workspace.artifactId === artifactId, 'review decision');
  return workspace;
}

export async function executeDwaionTeamArtifactRemediation(
  artifactId: string,
  input: ExecuteDwaionTeamArtifactRemediationInput
): Promise<DwaionTeamArtifactRemediationReceipt> {
  validateCommand(input, true);
  const requiresStage = input.action === 'REVIEW_NOTIFICATION';
  if (requiresStage !== (input.stageId !== null)) {
    throw new TypeError('Only review notification requires a review stage.');
  }
  if (input.stageId) assertAgentUuid(input.stageId, 'Artifact review stage identifier');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/remediation-actions`,
    {
      ...commandBody(input),
      changeReason: input.changeReason.trim(),
      action: input.action,
      stageId: input.stageId,
    },
    highRiskConfig(input)
  );
  return parseRemediationReceipt(response.data.data, artifactId, input.commandId, input.action);
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
  assertBinding(workspace.artifactId === artifactId && workspace.teamId === teamId, 'workspace');
  return workspace;
}

export async function createDwaionTeamArtifactAccessRequest(
  artifactId: string,
  teamId: string,
  preflightId: string,
  command: DwaionArtifactCollaborationHighRiskCommand
): Promise<DwaionTeamArtifactAccessRequest> {
  validateCommand(command, true);
  assertAgentUuid(teamId, 'Artifact collaboration team identifier');
  assertAgentUuid(preflightId, 'Artifact collaboration preflight identifier');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${artifactPath(artifactId)}/access-requests`,
    {
      ...commandBody(command),
      changeReason: command.changeReason.trim(),
      preflightId,
    },
    highRiskConfig(command)
  );
  const request = parseDwaionTeamArtifactAccessRequest(response.data.data);
  assertBinding(
    request.artifactId === artifactId &&
      request.teamId === teamId &&
      request.preflightId === preflightId,
    'access request'
  );
  return request;
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

function parseRemediationReceipt(
  value: unknown,
  artifactId: string,
  commandId: string,
  action: ExecuteDwaionTeamArtifactRemediationInput['action']
): DwaionTeamArtifactRemediationReceipt {
  if (
    !isAgentRecord(value) ||
    typeof value.receiptId !== 'string' ||
    typeof value.commandId !== 'string' ||
    typeof value.artifactId !== 'string' ||
    value.commandId !== commandId ||
    value.artifactId !== artifactId ||
    value.action !== action ||
    value.state !== 'SUCCEEDED' ||
    !Number.isSafeInteger(value.artifactRevision) ||
    Number(value.artifactRevision) < 1 ||
    !(
      value.workspaceRevision === null ||
      (Number.isSafeInteger(value.workspaceRevision) && Number(value.workspaceRevision) >= 1)
    ) ||
    !Number.isSafeInteger(value.affectedCount) ||
    Number(value.affectedCount) < 0 ||
    !(
      value.providerReceiptId === null ||
      (typeof value.providerReceiptId === 'string' && value.providerReceiptId.trim().length > 0)
    ) ||
    !(
      value.sourceContentFingerprint === null ||
      (typeof value.sourceContentFingerprint === 'string' &&
        /^[0-9a-f]{64}$/u.test(value.sourceContentFingerprint))
    ) ||
    !(
      value.findingManifestSha256 === null ||
      (typeof value.findingManifestSha256 === 'string' &&
        /^[0-9a-f]{64}$/u.test(value.findingManifestSha256))
    ) ||
    !(
      value.resultContentSha256 === null ||
      (typeof value.resultContentSha256 === 'string' &&
        /^[0-9a-f]{64}$/u.test(value.resultContentSha256))
    ) ||
    !Array.isArray(value.remediatedCodes) ||
    !(
      value.residualFindingCount === null ||
      (Number.isSafeInteger(value.residualFindingCount) && Number(value.residualFindingCount) >= 0)
    ) ||
    typeof value.resultSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(value.resultSha256) ||
    !isAgentDate(value.completedAt)
  ) {
    throw new HttpError('Artifact remediation receipt is invalid.', 502, value);
  }
  const codes = value.remediatedCodes as unknown[];
  if (action === 'REVIEW_NOTIFICATION') {
    if (
      value.providerReceiptId === null ||
      value.affectedCount !== 1 ||
      value.sourceContentFingerprint !== null ||
      value.findingManifestSha256 !== null ||
      value.resultContentSha256 !== null ||
      codes.length !== 0 ||
      value.residualFindingCount !== null
    ) {
      throw new HttpError('Artifact review notification evidence is invalid.', 502, value);
    }
  } else if (
    value.providerReceiptId !== null ||
    Number(value.affectedCount) < 1 ||
    typeof value.sourceContentFingerprint !== 'string' ||
    typeof value.findingManifestSha256 !== 'string' ||
    typeof value.resultContentSha256 !== 'string' ||
    value.residualFindingCount !== 0 ||
    codes.length < 1 ||
    codes.some((code) => typeof code !== 'string' || !/^[A-Z][A-Z0-9_.-]{1,63}$/u.test(code)) ||
    new Set(codes).size !== codes.length
  ) {
    throw new HttpError('Artifact content remediation evidence is invalid.', 502, value);
  }
  assertAgentUuid(value.receiptId, 'Artifact remediation receipt');
  assertAgentUuid(value.commandId, 'Artifact remediation command');
  assertAgentUuid(value.artifactId, 'Artifact remediation artifact');
  return value as DwaionTeamArtifactRemediationReceipt;
}

function validateCommand(command: DwaionArtifactCollaborationCommand, highRisk: boolean): void {
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

function validateCommentBody(value: string): void {
  if (value.trim().length < 1 || value.length > 4_000)
    throw new TypeError('Artifact comment body is invalid.');
}

export function newDwaionArtifactCollaborationCommandId(): string {
  return crypto.randomUUID();
}
