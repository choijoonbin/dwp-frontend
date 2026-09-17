import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createDwaionTeamArtifactComment,
  createDwaionTeamArtifactAccessRequest,
  createDwaionTeamArtifactShare,
  createDwaionTeamArtifactWorkspace,
  decideDwaionTeamArtifactReviewStage,
  getDwaionTeamArtifactCapabilities,
  getDwaionTeamArtifactComments,
  getDwaionTeamArtifactWorkspace,
  replyDwaionTeamArtifactComment,
  resolveDwaionTeamArtifactComment,
  resolveDwaionTeamArtifactConflict,
  revokeDwaionTeamArtifactShare,
  runDwaionTeamArtifactPreflight,
  submitDwaionTeamArtifactEdit,
  updateDwaionTeamArtifactMembers,
  type DwaionTeamArtifactConflictResolution,
  type DwaionTeamArtifactAccessRequest,
  type DwaionTeamArtifactComment,
  type DwaionTeamArtifactMemberRequest,
  type DwaionTeamArtifactPreflight,
  type DwaionTeamArtifactShare,
  type DwaionTeamArtifactSharePermission,
  type DwaionTeamArtifactReviewDecision,
  type DwaionTeamArtifactReviewStage,
} from '@dwp-frontend/shared-utils';

import { useDwaionGovernedMutation } from '../../../components/use-dwaion-governed-mutation';

import type { DwaionArtifactDocument } from './dwaion-artifact-model';
import {
  clearCollaborationAttempts,
  collaborationAttemptKey,
  collaborationCommand,
  collaborationCommandId,
  collaborationHighRiskCommand,
  collaborationPreflightSources,
  collaborationReason,
} from './dwaion-artifact-collaboration-command';

const COLLABORATION_KEY = ['dwaion', 'artifact-collaboration'] as const;

export function useDwaionArtifactCollaboration({
  document,
  enabled,
  locale,
}: {
  document: DwaionArtifactDocument | null;
  enabled: boolean;
  locale: 'ko' | 'en';
}) {
  const artifactId = document?.artifactId;
  const queryClient = useQueryClient();
  const attempts = useRef(new Map<string, string>());
  const [preflight, setPreflight] = useState<DwaionTeamArtifactPreflight | null>(null);
  const [latestShare, setLatestShare] = useState<DwaionTeamArtifactShare | null>(null);
  const [accessRequest, setAccessRequest] = useState<DwaionTeamArtifactAccessRequest | null>(null);
  useEffect(() => {
    setPreflight(null);
    setLatestShare(null);
    setAccessRequest(null);
    attempts.current.clear();
  }, [artifactId]);
  const governPreflight = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-preflight.action'
  );
  const governWorkspace = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-workspace.action'
  );
  const governMembers = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-members.action'
  );
  const governEdit = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-edit.action'
  );
  const governResolve = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-resolve.action'
  );
  const governShare = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-share.action'
  );
  const governAccessRequest = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-access-request.action'
  );
  const governComments = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-comments.action'
  );
  const governReview = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-collaboration-review-decision.action'
  );

  const capabilitiesQuery = useQuery({
    queryKey: [...COLLABORATION_KEY, 'capabilities'],
    queryFn: ({ signal }) => getDwaionTeamArtifactCapabilities(signal),
    enabled,
    staleTime: 30_000,
    retry: 1,
    meta: { accessSensitive: true },
  });
  const workspaceKey = useMemo(
    () => [...COLLABORATION_KEY, 'workspace', artifactId] as const,
    [artifactId]
  );
  const workspaceQuery = useQuery({
    queryKey: workspaceKey,
    queryFn: ({ signal }) => getDwaionTeamArtifactWorkspace(artifactId!, signal),
    enabled: enabled && Boolean(artifactId),
    staleTime: 5_000,
    retry: 1,
    meta: { accessSensitive: true },
  });
  const commentsKey = useMemo(
    () => [...COLLABORATION_KEY, 'comments', artifactId] as const,
    [artifactId]
  );
  const commentsQuery = useQuery({
    queryKey: commentsKey,
    queryFn: ({ signal }) => getDwaionTeamArtifactComments(artifactId!, signal),
    enabled:
      enabled &&
      Boolean(artifactId) &&
      Boolean(workspaceQuery.data) &&
      Boolean(
        capabilitiesQuery.data?.inlineComments.available &&
        capabilitiesQuery.data.inlineComments.configured
      ),
    staleTime: 5_000,
    retry: 1,
    meta: { accessSensitive: true },
  });

  const updateComment = useCallback(
    (comment: DwaionTeamArtifactComment) => {
      queryClient.setQueryData<DwaionTeamArtifactComment[]>(commentsKey, (current = []) => [
        ...current.filter((item) => item.commentId !== comment.commentId),
        comment,
      ]);
    },
    [commentsKey, queryClient]
  );

  const createCommentMutation = useMutation({
    mutationFn: async (input: { body: string; anchor: string | null }) => {
      const workspace = workspaceQuery.data;
      if (!document || !workspace) throw new Error('Workspace is required.');
      const key = collaborationAttemptKey('comment-create', workspace.workspaceId, input);
      return governComments((authority) =>
        createDwaionTeamArtifactComment(
          document.artifactId,
          input.body,
          input.anchor,
          collaborationCommand(
            collaborationCommandId(attempts.current, key),
            workspace.revision,
            'USER_CREATED_ARTIFACT_COMMENT',
            authority
          )
        )
      );
    },
    onSuccess: (comment) => {
      updateComment(comment);
      clearCollaborationAttempts(attempts.current, 'comment-create');
    },
    onError: () => void commentsQuery.refetch(),
  });

  const replyCommentMutation = useMutation({
    mutationFn: async (input: { comment: DwaionTeamArtifactComment; body: string }) => {
      if (!document) throw new Error('Artifact is required.');
      const key = collaborationAttemptKey(
        'comment-reply',
        input.comment.commentId,
        input.comment.revision,
        input.body
      );
      return governComments((authority) =>
        replyDwaionTeamArtifactComment(
          document.artifactId,
          input.comment.commentId,
          input.body,
          collaborationCommand(
            collaborationCommandId(attempts.current, key),
            input.comment.revision,
            'USER_REPLIED_TO_ARTIFACT_COMMENT',
            authority
          )
        )
      );
    },
    onSuccess: (comment) => {
      updateComment(comment);
      clearCollaborationAttempts(attempts.current, 'comment-reply');
    },
    onError: () => void commentsQuery.refetch(),
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async (comment: DwaionTeamArtifactComment) => {
      if (!document) throw new Error('Artifact is required.');
      const key = collaborationAttemptKey('comment-resolve', comment.commentId, comment.revision);
      return governComments((authority) =>
        resolveDwaionTeamArtifactComment(
          document.artifactId,
          comment.commentId,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            comment.revision,
            'USER_RESOLVED_ARTIFACT_COMMENT',
            collaborationReason(locale, 'commentResolution'),
            authority
          )
        )
      );
    },
    onSuccess: (comment) => {
      updateComment(comment);
      clearCollaborationAttempts(attempts.current, 'comment-resolve');
    },
    onError: () => void commentsQuery.refetch(),
  });

  const reviewDecisionMutation = useMutation({
    mutationFn: async (input: {
      stage: DwaionTeamArtifactReviewStage;
      decision: DwaionTeamArtifactReviewDecision;
    }) => {
      if (!document || !workspaceQuery.data) throw new Error('Workspace is required.');
      const key = collaborationAttemptKey(
        'review-decision',
        input.stage.stageId,
        input.stage.revision,
        input.decision
      );
      return governReview((authority) =>
        decideDwaionTeamArtifactReviewStage(document.artifactId, input.stage.stageId, {
          ...collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            input.stage.revision,
            'USER_DECIDED_ARTIFACT_REVIEW',
            collaborationReason(locale, 'reviewDecision'),
            authority
          ),
          decision: input.decision,
        })
      );
    },
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceKey, workspace);
      clearCollaborationAttempts(attempts.current, 'review-decision');
    },
    onError: () => void workspaceQuery.refetch(),
  });

  const workspaceMutation = useMutation({
    mutationFn: async ({ teamId }: { teamId: string }) => {
      if (!document || !preflight) throw new Error('Current preflight is required.');
      const key = collaborationAttemptKey('workspace', document.artifactId, preflight.preflightId);
      return governWorkspace((authority) =>
        createDwaionTeamArtifactWorkspace(
          document.artifactId,
          teamId,
          preflight.preflightId,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            document.revision,
            'USER_CONFIRMED_TEAM_WORKSPACE',
            collaborationReason(locale, 'workspace'),
            authority
          )
        )
      );
    },
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceKey, workspace);
      clearCollaborationAttempts(attempts.current, 'workspace');
    },
  });

  const accessRequestMutation = useMutation({
    mutationFn: async () => {
      if (!document || !preflight || preflight.state !== 'PERMISSION_DENIED')
        throw new Error('A permission-denied preflight is required.');
      const key = collaborationAttemptKey(
        'access-request',
        document.artifactId,
        document.revision,
        preflight.preflightId
      );
      return governAccessRequest((authority) =>
        createDwaionTeamArtifactAccessRequest(
          document.artifactId,
          preflight.teamId,
          preflight.preflightId,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            document.revision,
            'USER_REQUESTED_ARTIFACT_ACCESS',
            collaborationReason(locale, 'accessRequest'),
            authority
          )
        )
      );
    },
    onSuccess: (request) => {
      setAccessRequest(request);
      clearCollaborationAttempts(attempts.current, 'access-request');
    },
  });

  const preflightMutation = useMutation({
    mutationFn: async (input: {
      teamId: string;
      members: DwaionTeamArtifactMemberRequest[];
      excludeInaccessibleSources: boolean;
    }) => {
      if (!document) throw new Error('Artifact is required.');
      const key = collaborationAttemptKey(
        'preflight',
        document.artifactId,
        document.revision,
        input.teamId,
        input.members,
        input.excludeInaccessibleSources
      );
      return governPreflight((authority) =>
        runDwaionTeamArtifactPreflight(document.artifactId, {
          ...collaborationCommand(
            collaborationCommandId(attempts.current, key),
            document.revision,
            'USER_REQUESTED_TEAM_PREFLIGHT',
            authority
          ),
          teamId: input.teamId,
          artifactRevision: document.revision,
          members: input.members,
          sources: collaborationPreflightSources(document.sources),
          excludeInaccessibleSources: input.excludeInaccessibleSources,
        })
      );
    },
    onSuccess: (result) => {
      setPreflight(result);
      clearCollaborationAttempts(attempts.current, 'preflight');
    },
  });

  const membersMutation = useMutation({
    mutationFn: async () => {
      const workspace = workspaceQuery.data;
      if (!document || !workspace || !preflight)
        throw new Error('Workspace and preflight are required.');
      const key = collaborationAttemptKey('members', workspace.workspaceId, workspace.revision);
      return governMembers((authority) =>
        updateDwaionTeamArtifactMembers(
          document.artifactId,
          preflight.preflightId,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            workspace.revision,
            'USER_CONFIRMED_TEAM_MEMBER_UPDATE',
            collaborationReason(locale, 'members'),
            authority
          )
        )
      );
    },
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceKey, workspace);
      clearCollaborationAttempts(attempts.current, 'members');
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const workspace = workspaceQuery.data;
      if (!document || !workspace) throw new Error('Workspace is required.');
      const key = collaborationAttemptKey(
        'edit',
        workspace.workspaceId,
        workspace.revision,
        document.body
      );
      return governEdit((authority) =>
        submitDwaionTeamArtifactEdit(
          document.artifactId,
          workspace.revision,
          { title: document.title, body: document.body, format: 'MARKDOWN' },
          collaborationCommand(
            collaborationCommandId(attempts.current, key),
            workspace.revision,
            'USER_SYNCED_TEAM_ARTIFACT',
            authority
          )
        )
      );
    },
    onSuccess: (result) => {
      queryClient.setQueryData(workspaceKey, result.workspace);
      clearCollaborationAttempts(attempts.current, 'edit');
    },
  });

  const conflictMutation = useMutation({
    mutationFn: async (resolution: DwaionTeamArtifactConflictResolution) => {
      const workspace = workspaceQuery.data;
      const conflict = workspace?.openConflict;
      if (!document || !workspace || !conflict) throw new Error('Open conflict is required.');
      const key = collaborationAttemptKey(
        'resolve',
        conflict.conflictId,
        resolution,
        workspace.revision
      );
      return governResolve((authority) =>
        resolveDwaionTeamArtifactConflict(
          document.artifactId,
          conflict.conflictId,
          resolution,
          resolution === 'MERGE'
            ? { title: document.title, body: document.body, format: 'MARKDOWN' }
            : null,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            workspace.revision,
            `USER_RESOLVED_ARTIFACT_${resolution}`,
            collaborationReason(locale, 'conflict'),
            authority
          )
        )
      );
    },
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceKey, workspace);
      clearCollaborationAttempts(attempts.current, 'resolve');
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (input: {
      permission: DwaionTeamArtifactSharePermission;
      expiresAt: string;
    }) => {
      const workspace = workspaceQuery.data;
      if (!document || !workspace || !preflight)
        throw new Error('Workspace and preflight are required.');
      const key = collaborationAttemptKey('share', workspace.workspaceId, input);
      return governShare((authority) =>
        createDwaionTeamArtifactShare(
          document.artifactId,
          preflight.preflightId,
          input.permission,
          input.expiresAt,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            workspace.revision,
            'USER_CONFIRMED_INTERNAL_ARTIFACT_SHARE',
            collaborationReason(locale, 'share'),
            authority
          )
        )
      );
    },
    onSuccess: async (share) => {
      setLatestShare(share);
      clearCollaborationAttempts(attempts.current, 'share');
      await workspaceQuery.refetch();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const workspace = workspaceQuery.data;
      if (!document || !workspace) throw new Error('Workspace is required.');
      const key = collaborationAttemptKey('revoke', shareId, workspace.revision);
      return governShare((authority) =>
        revokeDwaionTeamArtifactShare(
          document.artifactId,
          shareId,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, key),
            workspace.revision,
            'USER_REVOKED_ARTIFACT_SHARE',
            collaborationReason(locale, 'revoke'),
            authority
          )
        )
      );
    },
    onSuccess: async (share) => {
      setLatestShare(share);
      clearCollaborationAttempts(attempts.current, 'revoke');
      await workspaceQuery.refetch();
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: async (input: {
      teamId: string;
      members: DwaionTeamArtifactMemberRequest[];
      excludeInaccessibleSources: boolean;
      permission: DwaionTeamArtifactSharePermission;
      expiresAt: string;
    }) => {
      if (!document) throw new Error('Artifact is required.');
      const attempt = collaborationAttemptKey(
        'resubmit',
        document.artifactId,
        document.revision,
        input
      );
      const nextPreflight = await governPreflight((authority) =>
        runDwaionTeamArtifactPreflight(document.artifactId, {
          ...collaborationCommand(
            collaborationCommandId(attempts.current, `${attempt}:preflight`),
            document.revision,
            'USER_RESUBMITTED_TEAM_ARTIFACT',
            authority
          ),
          teamId: input.teamId,
          artifactRevision: document.revision,
          members: input.members,
          sources: collaborationPreflightSources(document.sources),
          excludeInaccessibleSources: input.excludeInaccessibleSources,
        })
      );
      if (!['READY', 'PARTIAL'].includes(nextPreflight.state)) {
        setPreflight(nextPreflight);
        throw new Error('The renewed authorization preflight did not permit sharing.');
      }
      const nextWorkspace = await governWorkspace((authority) =>
        createDwaionTeamArtifactWorkspace(
          document.artifactId,
          input.teamId,
          nextPreflight.preflightId,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, `${attempt}:workspace`),
            document.revision,
            'USER_CONFIRMED_ARTIFACT_RESUBMISSION',
            collaborationReason(locale, 'resubmit'),
            authority
          )
        )
      );
      const share = await governShare((authority) =>
        createDwaionTeamArtifactShare(
          document.artifactId,
          nextPreflight.preflightId,
          input.permission,
          input.expiresAt,
          collaborationHighRiskCommand(
            collaborationCommandId(attempts.current, `${attempt}:share`),
            nextWorkspace.revision,
            'USER_CONFIRMED_ARTIFACT_RESUBMISSION_SHARE',
            collaborationReason(locale, 'resubmit'),
            authority
          )
        )
      );
      return { preflight: nextPreflight, workspace: nextWorkspace, share };
    },
    onSuccess: ({ preflight: nextPreflight, workspace, share }) => {
      setPreflight(nextPreflight);
      setLatestShare(share);
      queryClient.setQueryData(workspaceKey, {
        ...workspace,
        shares: [...workspace.shares.filter((item) => item.shareId !== share.shareId), share],
      });
      clearCollaborationAttempts(attempts.current, 'resubmit');
    },
  });

  const retry = useCallback(() => {
    void Promise.all([
      capabilitiesQuery.refetch(),
      workspaceQuery.refetch(),
      ...(commentsQuery.isEnabled ? [commentsQuery.refetch()] : []),
    ]);
  }, [capabilitiesQuery, commentsQuery, workspaceQuery]);

  const mutations = [
    preflightMutation,
    workspaceMutation,
    membersMutation,
    editMutation,
    conflictMutation,
    shareMutation,
    revokeMutation,
    accessRequestMutation,
    resubmitMutation,
    createCommentMutation,
    replyCommentMutation,
    resolveCommentMutation,
    reviewDecisionMutation,
  ];
  return {
    capabilities: capabilitiesQuery.data ?? null,
    workspace: workspaceQuery.data ?? null,
    preflight,
    latestShare,
    accessRequest,
    comments: commentsQuery.data ?? [],
    commentsLoading: commentsQuery.isPending && commentsQuery.isEnabled,
    commentsError: commentsQuery.error,
    loading: capabilitiesQuery.isPending || workspaceQuery.isPending,
    busy: mutations.some((mutation) => mutation.isPending),
    error: capabilitiesQuery.error ?? workspaceQuery.error ?? mutations.find((m) => m.error)?.error,
    retry,
    runPreflight: preflightMutation.mutateAsync,
    createWorkspace: workspaceMutation.mutateAsync,
    updateMembers: membersMutation.mutateAsync,
    syncEdit: editMutation.mutateAsync,
    resolveConflict: conflictMutation.mutateAsync,
    createShare: shareMutation.mutateAsync,
    revokeShare: revokeMutation.mutateAsync,
    requestAccess: accessRequestMutation.mutateAsync,
    resubmit: resubmitMutation.mutateAsync,
    createComment: createCommentMutation.mutateAsync,
    replyComment: replyCommentMutation.mutateAsync,
    resolveComment: resolveCommentMutation.mutateAsync,
    decideReviewStage: reviewDecisionMutation.mutateAsync,
  };
}
