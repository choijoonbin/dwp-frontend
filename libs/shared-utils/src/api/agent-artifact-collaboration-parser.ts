import { HttpError } from '../http-error';
import { isAgentDate, isAgentRecord } from './agent-governed-api';

import type {
  DwaionTeamArtifactCapabilities,
  DwaionTeamArtifactAccessRequest,
  DwaionTeamArtifactComment,
  DwaionTeamArtifactCommentReply,
  DwaionTeamArtifactConflict,
  DwaionTeamArtifactEditResult,
  DwaionTeamArtifactMember,
  DwaionTeamArtifactPreflight,
  DwaionTeamArtifactShare,
  DwaionTeamArtifactWorkspace,
} from './agent-artifact-collaboration-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9_.-]{1,127}$/u;
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9@._:-]{0,159}$/u;
const ROLES = new Set(['OWNER', 'EDITOR', 'REVIEWER', 'VIEWER']);
const PREFLIGHT_STATES = new Set(['READY', 'PARTIAL', 'PERMISSION_DENIED', 'EXPIRED']);
const WORKSPACE_STATES = new Set(['ACTIVE', 'READ_ONLY', 'REVOKED']);
const CONFLICT_STATES = new Set([
  'OPEN',
  'RESOLVED_LOCAL',
  'RESOLVED_SERVER',
  'RESOLVED_MERGED',
  'STASHED',
  'ROLLED_BACK',
]);

export function parseDwaionTeamArtifactCapabilities(
  value: unknown
): DwaionTeamArtifactCapabilities {
  if (
    !isAgentRecord(value) ||
    !capabilityKeys.every((key) => typeof value[key] === 'boolean') ||
    !providerCapabilityKeys.every((key) => providerCapability(value[key])) ||
    providerOnlyUnavailableKeys.some(
      (key) => isAgentRecord(value[key]) && value[key].available !== false
    ) ||
    value.externalSharingAvailable !== false ||
    !['AVAILABLE', 'NOT_CONFIGURED', 'DATABASE_NOT_CONFIGURED', 'SECURITY_NOT_CONFIGURED'].includes(
      String(value.providerState)
    ) ||
    !(value.recoveryHint === null || nonBlank(value.recoveryHint)) ||
    (value.providerState !== 'AVAILABLE' &&
      (!nonBlank(value.recoveryHint) ||
        capabilityKeys.some((key) => value[key] !== false) ||
        providerCapabilityKeys.some(
          (key) =>
            isAgentRecord(value[key]) &&
            (value[key].available !== false || value[key].configured !== false)
        )))
  ) {
    throw invalid('Artifact collaboration capabilities response is invalid.', value);
  }
  return value as DwaionTeamArtifactCapabilities;
}

export function parseDwaionTeamArtifactPreflight(value: unknown): DwaionTeamArtifactPreflight {
  if (
    !isAgentRecord(value) ||
    !uuid(value.preflightId) ||
    !uuid(value.artifactId) ||
    !uuid(value.teamId) ||
    !integer(value.artifactRevision, 1) ||
    typeof value.state !== 'string' ||
    !PREFLIGHT_STATES.has(value.state) ||
    !integer(value.decisionRevision, 1) ||
    !members(value.members) ||
    !integer(value.allowedSourceCount, 0, 20) ||
    !integer(value.excludedSourceCount, 0, 20) ||
    !sha(value.evidenceSha256) ||
    !isAgentDate(value.expiresAt) ||
    !isAgentDate(value.createdAt)
  ) {
    throw invalid('Artifact collaboration preflight response is invalid.', value);
  }
  const deniedMembers = value.members.filter((member) => !member.allowed).length;
  if (
    (value.state === 'READY' && (deniedMembers > 0 || value.excludedSourceCount !== 0)) ||
    (value.state === 'PARTIAL' && (deniedMembers > 0 || value.excludedSourceCount === 0)) ||
    (value.state === 'PERMISSION_DENIED' &&
      deniedMembers === 0 &&
      value.excludedSourceCount === 0) ||
    Date.parse(value.expiresAt) <= Date.parse(value.createdAt) ||
    (value.state === 'EXPIRED' && Date.parse(value.expiresAt) > Date.now())
  ) {
    throw invalid('Artifact collaboration preflight state is contradictory.', value);
  }
  return value as DwaionTeamArtifactPreflight;
}

export function parseDwaionTeamArtifactAccessRequest(
  value: unknown
): DwaionTeamArtifactAccessRequest {
  if (
    !isAgentRecord(value) ||
    !uuid(value.accessRequestId) ||
    !uuid(value.artifactId) ||
    !uuid(value.teamId) ||
    !uuid(value.preflightId) ||
    !['PENDING', 'APPROVED', 'DENIED', 'EXPIRED'].includes(String(value.state)) ||
    !integer(value.deniedSubjectCount, 0, 100) ||
    !integer(value.deniedSourceCount, 0, 20) ||
    Number(value.deniedSubjectCount) + Number(value.deniedSourceCount) < 1 ||
    !sha(value.submissionEvidenceSha256) ||
    !isAgentDate(value.createdAt)
  ) {
    throw invalid('Artifact collaboration access-request response is invalid.', value);
  }
  return value as DwaionTeamArtifactAccessRequest;
}

export function parseDwaionTeamArtifactWorkspace(value: unknown): DwaionTeamArtifactWorkspace {
  if (
    !isAgentRecord(value) ||
    !uuid(value.workspaceId) ||
    !uuid(value.artifactId) ||
    !uuid(value.teamId) ||
    typeof value.state !== 'string' ||
    !WORKSPACE_STATES.has(value.state) ||
    !integer(value.revision, 1) ||
    !content(value.content) ||
    !sha(value.contentSha256) ||
    !members(value.members) ||
    !Array.isArray(value.shares) ||
    !value.shares.every(isShare) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt)
  ) {
    throw invalid('Artifact collaboration workspace response is invalid.', value);
  }
  const conflict = value.openConflict;
  if (
    value.members.filter((member) => member.allowed && member.role === 'OWNER').length !== 1 ||
    value.shares.some((share) => share.workspaceId !== value.workspaceId) ||
    (conflict !== null &&
      (!isConflict(conflict) ||
        conflict.workspaceId !== value.workspaceId ||
        conflict.state !== 'OPEN'))
  ) {
    throw invalid('Artifact collaboration workspace binding is invalid.', value);
  }
  return value as DwaionTeamArtifactWorkspace;
}

export function parseDwaionTeamArtifactEditResult(value: unknown): DwaionTeamArtifactEditResult {
  if (!isAgentRecord(value) || !['APPLIED', 'CONFLICT'].includes(String(value.state))) {
    throw invalid('Artifact collaboration edit response is invalid.', value);
  }
  const workspace = parseDwaionTeamArtifactWorkspace(value.workspace);
  if (
    (value.state === 'CONFLICT') !== (value.conflict !== null) ||
    (value.conflict !== null &&
      (!isConflict(value.conflict) || value.conflict.workspaceId !== workspace.workspaceId))
  ) {
    throw invalid('Artifact collaboration edit result is contradictory.', value);
  }
  return value as DwaionTeamArtifactEditResult;
}

export function parseDwaionTeamArtifactShare(value: unknown): DwaionTeamArtifactShare {
  if (!isShare(value)) throw invalid('Artifact collaboration share response is invalid.', value);
  return value;
}

export function parseDwaionTeamArtifactComment(value: unknown): DwaionTeamArtifactComment {
  if (!isComment(value))
    throw invalid('Artifact collaboration comment response is invalid.', value);
  return value;
}

export function parseDwaionTeamArtifactComments(value: unknown): DwaionTeamArtifactComment[] {
  if (!Array.isArray(value) || !value.every(isComment))
    throw invalid('Artifact collaboration comments response is invalid.', value);
  const commentIds = value.map((comment) => comment.commentId);
  if (new Set(commentIds).size !== commentIds.length)
    throw invalid('Artifact collaboration comments contain duplicate identifiers.', value);
  return value;
}

function members(value: unknown): value is DwaionTeamArtifactMember[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 100 &&
    value.every(isMember) &&
    new Set(value.map((member) => member.subjectId)).size === value.length
  );
}

function isMember(value: unknown): value is DwaionTeamArtifactMember {
  return (
    isAgentRecord(value) &&
    typeof value.subjectId === 'string' &&
    SUBJECT.test(value.subjectId) &&
    typeof value.role === 'string' &&
    ROLES.has(value.role) &&
    typeof value.allowed === 'boolean' &&
    integer(value.deniedSourceCount, 0) &&
    (value.reasonCode === null ||
      (typeof value.reasonCode === 'string' && SAFE_CODE.test(value.reasonCode))) &&
    (value.allowed
      ? value.deniedSourceCount === 0 && value.reasonCode === null
      : value.reasonCode !== null)
  );
}

function isConflict(value: unknown): value is DwaionTeamArtifactConflict {
  if (
    !isAgentRecord(value) ||
    !uuid(value.conflictId) ||
    !uuid(value.workspaceId) ||
    !integer(value.baseRevision, 1) ||
    !integer(value.serverRevision, 1) ||
    typeof value.state !== 'string' ||
    !CONFLICT_STATES.has(value.state) ||
    !content(value.localContent) ||
    !content(value.serverContent) ||
    !sha(value.localSha256) ||
    !sha(value.serverSha256) ||
    !isAgentDate(value.createdAt) ||
    !(value.resolvedAt === null || isAgentDate(value.resolvedAt))
  )
    return false;
  return (value.state === 'OPEN') === (value.resolvedAt === null);
}

function isShare(value: unknown): value is DwaionTeamArtifactShare {
  if (
    !isAgentRecord(value) ||
    !uuid(value.shareId) ||
    !uuid(value.workspaceId) ||
    !['ACTIVE', 'EXPIRED', 'REVOKED'].includes(String(value.state)) ||
    !['VIEW', 'COMMENT', 'EDIT'].includes(String(value.permission)) ||
    !integer(value.memberCount, 1, 100) ||
    !isAgentDate(value.expiresAt) ||
    !(value.revokedAt === null || isAgentDate(value.revokedAt)) ||
    !uuid(value.receiptId) ||
    !sha(value.receiptSha256) ||
    !(value.revocationReceiptId === null || uuid(value.revocationReceiptId)) ||
    !(value.revocationReceiptSha256 === null || sha(value.revocationReceiptSha256)) ||
    !isAgentDate(value.createdAt)
  )
    return false;
  const revoked = value.state === 'REVOKED';
  return (
    Date.parse(value.expiresAt) > Date.parse(value.createdAt) &&
    revoked === (value.revokedAt !== null) &&
    revoked === (value.revocationReceiptId !== null) &&
    revoked === (value.revocationReceiptSha256 !== null)
  );
}

function isComment(value: unknown): value is DwaionTeamArtifactComment {
  if (
    !isAgentRecord(value) ||
    !uuid(value.commentId) ||
    !uuid(value.workspaceId) ||
    !uuid(value.artifactId) ||
    !boundedText(value.authorSubjectId, 160) ||
    !(value.authorDisplayName === null || boundedText(value.authorDisplayName, 200)) ||
    !boundedText(value.body, 4_000) ||
    !(value.anchor === null || boundedText(value.anchor, 1_000)) ||
    !['OPEN', 'RESOLVED'].includes(String(value.state)) ||
    !integer(value.revision, 1) ||
    !Array.isArray(value.replies) ||
    value.replies.length > 500 ||
    !value.replies.every((reply) => isCommentReply(reply, String(value.commentId))) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt) ||
    !(value.resolvedAt === null || isAgentDate(value.resolvedAt))
  )
    return false;
  return (
    (value.state === 'RESOLVED') === (value.resolvedAt !== null) &&
    Date.parse(value.updatedAt) >= Date.parse(value.createdAt) &&
    (value.resolvedAt === null || Date.parse(value.resolvedAt) >= Date.parse(value.createdAt)) &&
    new Set(value.replies.map((reply) => reply.replyId)).size === value.replies.length
  );
}

function isCommentReply(
  value: unknown,
  commentId: string
): value is DwaionTeamArtifactCommentReply {
  return (
    isAgentRecord(value) &&
    uuid(value.replyId) &&
    value.commentId === commentId &&
    boundedText(value.authorSubjectId, 160) &&
    (value.authorDisplayName === null || boundedText(value.authorDisplayName, 200)) &&
    boundedText(value.body, 4_000) &&
    isAgentDate(value.createdAt)
  );
}

function content(value: unknown) {
  return (
    isAgentRecord(value) &&
    nonBlank(value.title) &&
    value.title.length <= 200 &&
    nonBlank(value.body) &&
    value.body.length <= 100_000 &&
    value.format === 'MARKDOWN'
  );
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function sha(value: unknown): value is string {
  return typeof value === 'string' && SHA256.test(value);
}

function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function boundedText(value: unknown, maximum: number): value is string {
  return nonBlank(value) && value.length <= maximum;
}

const capabilityKeys = [
  'teamWorkspaceAvailable',
  'aclPreflightAvailable',
  'accessRequestAvailable',
  'collaborationAvailable',
  'conflictResolutionAvailable',
  'internalSharingAvailable',
  'externalSharingAvailable',
  'shareExpiryAvailable',
  'shareRevocationAvailable',
] as const;

const providerCapabilityKeys = [
  'inlineComments',
  'automaticMasking',
  'syntheticReplacement',
  'reviewNotification',
  'reviewRejection',
] as const;

const providerOnlyUnavailableKeys = [
  'automaticMasking',
  'syntheticReplacement',
  'reviewNotification',
  'reviewRejection',
] as const;

function providerCapability(value: unknown) {
  return (
    isAgentRecord(value) &&
    typeof value.available === 'boolean' &&
    typeof value.configured === 'boolean' &&
    (value.reasonCode === null ||
      (typeof value.reasonCode === 'string' && SAFE_CODE.test(value.reasonCode))) &&
    (value.recoveryHint === null || nonBlank(value.recoveryHint)) &&
    (!value.available || value.configured)
  );
}

function invalid(message: string, value: unknown) {
  return new HttpError(message, 502, value);
}
