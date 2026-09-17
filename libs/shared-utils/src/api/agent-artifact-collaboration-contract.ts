import type { DwaionArtifactDraftContent, DwaionArtifactSourceReference } from './agent-artifact-api';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

export type DwaionTeamArtifactRole = 'OWNER' | 'EDITOR' | 'REVIEWER' | 'VIEWER';
export type DwaionTeamArtifactWorkspaceState = 'ACTIVE' | 'READ_ONLY' | 'REVOKED';
export type DwaionTeamArtifactPreflightState =
  | 'READY'
  | 'PARTIAL'
  | 'PERMISSION_DENIED'
  | 'EXPIRED';
export type DwaionTeamArtifactConflictState =
  | 'OPEN'
  | 'RESOLVED_LOCAL'
  | 'RESOLVED_SERVER'
  | 'RESOLVED_MERGED'
  | 'STASHED'
  | 'ROLLED_BACK';
export type DwaionTeamArtifactConflictResolution =
  | 'USE_LOCAL'
  | 'USE_SERVER'
  | 'MERGE'
  | 'STASH'
  | 'ROLLBACK';
export type DwaionTeamArtifactShareState = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type DwaionTeamArtifactSharePermission = 'VIEW' | 'COMMENT' | 'EDIT';

export type DwaionTeamArtifactMemberRequest = {
  subjectId: string;
  role: DwaionTeamArtifactRole;
};

export type DwaionTeamArtifactMember = DwaionTeamArtifactMemberRequest & {
  allowed: boolean;
  deniedSourceCount: number;
  reasonCode: string | null;
};

export type DwaionTeamArtifactCapabilities = {
  teamWorkspaceAvailable: boolean;
  aclPreflightAvailable: boolean;
  collaborationAvailable: boolean;
  conflictResolutionAvailable: boolean;
  internalSharingAvailable: boolean;
  externalSharingAvailable: false;
  shareExpiryAvailable: boolean;
  shareRevocationAvailable: boolean;
  providerState: 'AVAILABLE' | 'NOT_CONFIGURED';
  recoveryHint: string | null;
};

export type DwaionTeamArtifactPreflight = {
  preflightId: string;
  artifactId: string;
  teamId: string;
  artifactRevision: number;
  state: DwaionTeamArtifactPreflightState;
  decisionRevision: number;
  members: DwaionTeamArtifactMember[];
  allowedSourceCount: number;
  excludedSourceCount: number;
  evidenceSha256: string;
  expiresAt: string;
  createdAt: string;
};

export type DwaionTeamArtifactConflict = {
  conflictId: string;
  workspaceId: string;
  baseRevision: number;
  serverRevision: number;
  state: DwaionTeamArtifactConflictState;
  localContent: DwaionArtifactDraftContent;
  serverContent: DwaionArtifactDraftContent;
  localSha256: string;
  serverSha256: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type DwaionTeamArtifactShare = {
  shareId: string;
  workspaceId: string;
  state: DwaionTeamArtifactShareState;
  permission: DwaionTeamArtifactSharePermission;
  memberCount: number;
  expiresAt: string;
  revokedAt: string | null;
  receiptId: string;
  receiptSha256: string;
  revocationReceiptId: string | null;
  revocationReceiptSha256: string | null;
  createdAt: string;
};

export type DwaionTeamArtifactWorkspace = {
  workspaceId: string;
  artifactId: string;
  teamId: string;
  state: DwaionTeamArtifactWorkspaceState;
  revision: number;
  content: DwaionArtifactDraftContent;
  contentSha256: string;
  members: DwaionTeamArtifactMember[];
  openConflict: DwaionTeamArtifactConflict | null;
  shares: DwaionTeamArtifactShare[];
  createdAt: string;
  updatedAt: string;
};

export type DwaionTeamArtifactEditResult = {
  state: 'APPLIED' | 'CONFLICT';
  workspace: DwaionTeamArtifactWorkspace;
  conflict: DwaionTeamArtifactConflict | null;
};

export type DwaionArtifactCollaborationCommand = {
  commandId: string;
  expectedRevision: number;
  reasonCode: string;
  authority?: ProductSurfaceGovernedMutationAuthority;
};

export type DwaionArtifactCollaborationHighRiskCommand =
  DwaionArtifactCollaborationCommand & {
    changeReason: string;
  };

export type RunDwaionTeamArtifactPreflightInput = DwaionArtifactCollaborationCommand & {
  teamId: string;
  artifactRevision: number;
  members: DwaionTeamArtifactMemberRequest[];
  sources: DwaionArtifactSourceReference[];
  excludeInaccessibleSources: boolean;
};
