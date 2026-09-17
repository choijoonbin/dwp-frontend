import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  autosaveDwaionArtifact,
  createDwaionArtifact,
  createDwaionArtifactVersion,
  getCurrentDwaionArtifactPreflight,
  getDwaionArtifact,
  getDwaionArtifacts,
  getDwaionArtifactVersion,
  getDwaionArtifactVersions,
  HttpError,
  publishDwaionArtifact,
  requestDwaionArtifactExport,
  runDwaionArtifactPreflight,
  useAuth,
  usePermissions,
  useToast,
  type DwaionArtifactExportFormat,
  type DwaionArtifactPreflightReceipt,
  type DwaionArtifactVersionDetail,
  type DwaionArtifactVersionSummary,
  type DwaionGovernedArtifact,
} from '@dwp-frontend/shared-utils';

import {
  DWAION_ARTIFACT_COPY_EN,
  DWAION_ARTIFACT_COPY_KO,
} from './artifact-studio/dwaion-artifact-copy';
import { DwaionArtifactStudio } from './artifact-studio/dwaion-artifact-studio';
import { DwaionArtifactCollaboration } from './artifact-studio/dwaion-artifact-collaboration';
import { DwaionArtifactInlineComments } from './artifact-studio/dwaion-artifact-inline-comments';
import { useDwaionArtifactAutosave } from './artifact-studio/use-dwaion-artifact-autosave';
import { useDwaionArtifactCollaboration } from './artifact-studio/use-dwaion-artifact-collaboration';

import type { DwaionArtifactExportFormat as UiExportFormat } from './artifact-studio/dwaion-artifact-export-dialog';
import type {
  DwaionArtifactDocument,
  DwaionArtifactEvidence,
  DwaionArtifactExportEvidence,
  DwaionArtifactType,
  DwaionArtifactVersion,
  DwaionDlpPreflight,
} from './artifact-studio/dwaion-artifact-model';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

const ARTIFACTS_KEY = ['dwaion', 'governed-artifacts'] as const;

export function DwaionArtifacts() {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = locale === 'ko' ? DWAION_ARTIFACT_COPY_KO : DWAION_ARTIFACT_COPY_EN;
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const governAutosave = useDwaionGovernedMutation('route.dwaion.work.artifact-autosave.action');
  const governCreate = useDwaionGovernedMutation('route.dwaion.work.artifact-create.action');
  const governVersion = useDwaionGovernedMutation(
    'route.dwaion.work.artifact-version-create.action'
  );
  const governPreflight = useDwaionGovernedMutation('route.dwaion.work.artifact-preflight.action');
  const governPublish = useDwaionGovernedMutation('route.dwaion.work.artifact-publish.action');
  const governExport = useDwaionGovernedMutation('route.dwaion.work.artifact-export.action');
  const [searchParams, setSearchParams] = useSearchParams();
  const identity = `${user?.tenantId ?? ''}:${user?.userId ?? ''}`;
  const canView = isAuthenticated && isLoaded && hasPermission('APP.DWAION_ARTIFACTS', 'VIEW');
  const canCreate = canView && hasPermission('APP.DWAION_ARTIFACTS', 'CREATE');
  const canEdit = canView && hasPermission('APP.DWAION_ARTIFACTS', 'UPDATE');
  const canPublish = canView && hasPermission('APP.DWAION_ARTIFACTS', 'PUBLISH');
  const canExport = canView && hasPermission('APP.DWAION_ARTIFACTS', 'EXPORT');

  const artifactsQuery = useQuery({
    queryKey: [...ARTIFACTS_KEY, identity],
    queryFn: getDwaionArtifacts,
    enabled: canView,
    staleTime: 15_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const requestedArtifactId = searchParams.get('artifact')?.trim() || undefined;
  const [deniedVersion, setDeniedVersion] = useState<{
    artifactId: string;
    versionNumber: number;
  } | null>(null);
  const requestedArtifactAvailable = artifactsQuery.data?.some(
    (artifact) => artifact.artifactId === requestedArtifactId
  );
  const requestedArtifactUnavailable = Boolean(
    requestedArtifactId && artifactsQuery.isSuccess && !requestedArtifactAvailable
  );
  const effectiveSelectedId = requestedArtifactId
    ? requestedArtifactAvailable
      ? requestedArtifactId
      : undefined
    : artifactsQuery.data?.[0]?.artifactId;
  const detailQuery = useQuery({
    queryKey: [...ARTIFACTS_KEY, 'detail', identity, effectiveSelectedId],
    queryFn: () => getDwaionArtifact(effectiveSelectedId!),
    enabled: canView && Boolean(effectiveSelectedId),
    staleTime: 10_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const versionsQuery = useQuery({
    queryKey: [...ARTIFACTS_KEY, 'versions', identity, effectiveSelectedId],
    queryFn: () => getDwaionArtifactVersions(effectiveSelectedId!),
    enabled: canView && Boolean(effectiveSelectedId),
    staleTime: 15_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const preflightQuery = useQuery({
    queryKey: [...ARTIFACTS_KEY, 'preflight', identity, effectiveSelectedId],
    queryFn: () => getCurrentDwaionArtifactPreflight(effectiveSelectedId!),
    enabled: canView && Boolean(effectiveSelectedId),
    staleTime: 10_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });

  const accessDenied = !canView || isAccessDenied(artifactsQuery.error);
  const selectionAccessDenied =
    requestedArtifactUnavailable ||
    [detailQuery.error, versionsQuery.error, preflightQuery.error].some(isAccessDenied) ||
    Boolean(deniedVersion && deniedVersion.artifactId === effectiveSelectedId);
  const selectionAvailable = !accessDenied && !selectionAccessDenied;

  const [commandError, setCommandError] = useState<
    'REVISION_CONFLICT' | 'COMMAND_FAILED' | undefined
  >();
  const [exportReceipt, setExportReceipt] = useState<
    (DwaionArtifactExportEvidence & { ownerIdentity: string }) | null
  >(null);

  const handleCommandError = useCallback(
    (error: unknown) => {
      const conflict = error instanceof HttpError && error.status === 409;
      setCommandError(conflict ? 'REVISION_CONFLICT' : 'COMMAND_FAILED');
      void queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY });
      toast.error(conflict ? copy.revisionConflict : copy.commandFailed);
    },
    [copy.commandFailed, copy.revisionConflict, queryClient, toast]
  );

  const saveArtifact = useCallback(
    async (
      artifactId: string,
      expectedRevision: number,
      content: { title: string; body: string },
      sources: DwaionArtifactDocument['sources']
    ) => {
      const saved = await governAutosave((authority) =>
        autosaveDwaionArtifact(
          artifactId,
          expectedRevision,
          { ...content, format: 'MARKDOWN' },
          [...sources],
          authority
        )
      );
      const rejected = ['detail', 'versions', 'preflight'].some((scope) =>
        isAccessDenied(
          queryClient.getQueryState([...ARTIFACTS_KEY, scope, identity, artifactId])?.error
        )
      );
      if (!rejected) {
        queryClient.setQueryData([...ARTIFACTS_KEY, 'detail', identity, artifactId], saved);
      }
      void queryClient.invalidateQueries({ queryKey: [...ARTIFACTS_KEY, identity] });
      setCommandError(undefined);
      return toDocument(saved, 'SAVED');
    },
    [governAutosave, identity, queryClient]
  );

  const serverArtifact =
    detailQuery.data ??
    artifactsQuery.data?.find((artifact) => artifact.artifactId === effectiveSelectedId) ??
    null;
  const serverDocument =
    selectionAvailable && serverArtifact ? toDocument(serverArtifact, 'IDLE') : null;
  const autosave = useDwaionArtifactAutosave({
    serverDocument,
    enabled: canEdit && selectionAvailable,
    save: saveArtifact,
    onError: handleCommandError,
  });
  const collaboration = useDwaionArtifactCollaboration({
    document: autosave.document,
    enabled: canView && selectionAvailable,
    locale,
  });
  const collaborationDraftMutation = useMutation({
    mutationFn: async ({ explanation }: { explanation?: string }) => {
      const document = autosave.document;
      if (!document) throw new Error('Artifact is not selected.');
      const body = explanation
        ? `${document.body.trimEnd()}\n\n## ${locale === 'ko' ? '검토 소명' : 'Review explanation'}\n${explanation}`
        : document.body;
      const saved = await saveArtifact(
        document.artifactId,
        document.revision,
        { title: document.title, body },
        document.sources
      );
      const version = await governVersion((authority) =>
        createDwaionArtifactVersion(saved.artifactId, saved.revision, authority)
      );
      return { saved, version };
    },
    onSuccess: async ({ saved }) => {
      setCommandError(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ARTIFACTS_KEY, identity] }),
        queryClient.invalidateQueries({
          queryKey: [...ARTIFACTS_KEY, 'detail', identity, saved.artifactId],
        }),
        queryClient.invalidateQueries({
          queryKey: [...ARTIFACTS_KEY, 'versions', identity, saved.artifactId],
        }),
      ]);
      toast.success(copy.save);
    },
    onError: handleCommandError,
  });

  const createMutation = useMutation({
    mutationFn: (input: { artifactType: DwaionArtifactType; title: string; body: string }) =>
      governCreate((authority) =>
        createDwaionArtifact(
          {
            artifactType: input.artifactType,
            content: { title: input.title, body: input.body, format: 'MARKDOWN' },
            sources: [],
          },
          authority
        )
      ),
    onSuccess: async (artifact) => {
      setSearchParams({ artifact: artifact.artifactId }, { replace: true });
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY });
      toast.success(copy.save);
    },
    onError: handleCommandError,
  });
  const preflightMutation = useMutation({
    mutationFn: async (artifact: DwaionArtifactDocument) => {
      const version = await governVersion((authority) =>
        createDwaionArtifactVersion(artifact.artifactId, artifact.revision, authority)
      );
      return governPreflight((authority) =>
        runDwaionArtifactPreflight(
          artifact.artifactId,
          version.artifactRevision,
          version.versionNumber,
          authority
        )
      );
    },
    onSuccess: async (receipt) => {
      setCommandError(undefined);
      if (
        !isAccessDenied(
          queryClient.getQueryState([...ARTIFACTS_KEY, 'preflight', identity, receipt.artifactId])
            ?.error
        )
      ) {
        queryClient.setQueryData(
          [...ARTIFACTS_KEY, 'preflight', identity, receipt.artifactId],
          receipt
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ARTIFACTS_KEY, identity] }),
        queryClient.invalidateQueries({
          queryKey: [...ARTIFACTS_KEY, 'detail', identity, receipt.artifactId],
        }),
        queryClient.invalidateQueries({
          queryKey: [...ARTIFACTS_KEY, 'versions', identity, receipt.artifactId],
        }),
      ]);
      toast.success(copy.preflightStates[receipt.outcome]);
    },
    onError: handleCommandError,
  });
  const publishMutation = useMutation({
    mutationFn: (input: { artifact: DwaionArtifactDocument; preflight: DwaionDlpPreflight }) =>
      governPublish((authority) =>
        publishDwaionArtifact(
          input.artifact.artifactId,
          input.artifact.revision,
          input.preflight.versionNumber,
          input.preflight.preflightId,
          authority
        )
      ),
    onSuccess: async (receipt) => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY });
      toast.success(copy.publish);
      setSearchParams({ artifact: receipt.artifactId }, { replace: true });
    },
    onError: handleCommandError,
  });
  const exportMutation = useMutation({
    mutationFn: (input: {
      artifact: DwaionArtifactDocument;
      preflight: DwaionDlpPreflight;
      format: UiExportFormat;
      ownerIdentity: string;
    }) =>
      governExport((authority) =>
        requestDwaionArtifactExport(
          input.artifact.artifactId,
          input.artifact.revision,
          input.preflight.versionNumber,
          input.preflight.preflightId,
          input.format as DwaionArtifactExportFormat,
          authority
        )
      ),
    onSuccess: async (receipt, input) => {
      setExportReceipt({
        artifactId: receipt.artifactId,
        ownerIdentity: input.ownerIdentity,
        exportJobId: receipt.exportJobId,
        exportFormat: receipt.exportFormat,
        state: receipt.state,
        executionAvailable: receipt.executionAvailable,
        fileAvailable: receipt.fileAvailable,
        fileName: receipt.fileName ?? null,
        byteSize: receipt.byteSize ?? null,
        contentFingerprint: receipt.contentFingerprint ?? null,
        completedAt: receipt.completedAt ?? null,
        safeErrorCode: receipt.safeErrorCode ?? null,
      });
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY });
      toast.success(copy.exportReceipt);
    },
    onError: handleCommandError,
  });

  const summaries = useMemo(
    () => (accessDenied ? [] : (artifactsQuery.data ?? [])).map(toSummary),
    [accessDenied, artifactsQuery.data]
  );
  const versions = useMemo(
    () => (selectionAvailable ? (versionsQuery.data ?? []) : []).map(toVersionSummary),
    [selectionAvailable, versionsQuery.data]
  );
  const preflight =
    selectionAvailable && preflightQuery.data ? toPreflight(preflightQuery.data) : null;
  const evidence = (autosave.document?.sources ?? []).map(toEvidence);
  const state = !isLoaded
    ? 'loading'
    : accessDenied
      ? 'permission-denied'
      : artifactsQuery.isPending
        ? 'loading'
        : artifactsQuery.isError
          ? 'error'
          : 'ready';
  const partialError = requestedArtifactUnavailable
    ? copy.selectionUnavailableDescription
    : selectionAccessDenied ||
        detailQuery.isError ||
        versionsQuery.isError ||
        preflightQuery.isError
      ? copy.partial
      : undefined;

  return (
    <DwaionArtifactStudio
      key={`${identity}:${effectiveSelectedId}:${selectionAvailable}`}
      state={state}
      selectionAccessDenied={selectionAccessDenied}
      selectionMissing={requestedArtifactUnavailable}
      artifacts={summaries}
      document={autosave.document}
      evidence={evidence}
      versions={versions}
      preflight={preflight}
      exportReceipt={
        selectionAvailable &&
        exportReceipt &&
        exportReceipt.artifactId === effectiveSelectedId &&
        exportReceipt.ownerIdentity === identity
          ? exportReceipt
          : null
      }
      partialError={partialError}
      commandError={commandError}
      canCreate={canCreate && !accessDenied}
      canEdit={canEdit && selectionAvailable}
      canPublish={canPublish && selectionAvailable}
      canExport={canExport && selectionAvailable}
      createBusy={createMutation.isPending}
      preflightBusy={preflightMutation.isPending}
      publishBusy={publishMutation.isPending}
      exportBusy={exportMutation.isPending}
      onRetry={() => {
        void Promise.all([
          artifactsQuery.refetch(),
          ...(effectiveSelectedId
            ? [detailQuery.refetch(), versionsQuery.refetch(), preflightQuery.refetch()]
            : []),
        ]);
        if (deniedVersion && deniedVersion.artifactId === effectiveSelectedId) {
          void getDwaionArtifactVersion(deniedVersion.artifactId, deniedVersion.versionNumber)
            .then(() => setDeniedVersion((current) => (current === deniedVersion ? null : current)))
            .catch(() => undefined);
        }
      }}
      onCreate={(input) => createMutation.mutateAsync(input).then(() => undefined)}
      onSelect={(artifactId) => {
        setSearchParams({ artifact: artifactId }, { replace: true });
        setExportReceipt(null);
      }}
      onDraftChange={autosave.update}
      onLoadVersion={async (versionNumber) => {
        if (!effectiveSelectedId) throw new Error('Artifact is not selected.');
        try {
          return toVersionDetail(
            await getDwaionArtifactVersion(effectiveSelectedId, versionNumber)
          );
        } catch (error) {
          if (isAccessDenied(error))
            setDeniedVersion({ artifactId: effectiveSelectedId, versionNumber });
          throw error;
        }
      }}
      onRunPreflight={(artifact) => preflightMutation.mutate(artifact)}
      onPublish={(artifact, receipt) => publishMutation.mutate({ artifact, preflight: receipt })}
      onExport={(artifact, receipt, format) =>
        exportMutation
          .mutateAsync({ artifact, preflight: receipt, format, ownerIdentity: identity })
          .then(() => undefined)
      }
      copy={copy}
      formatTimestamp={(value) =>
        formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale)
      }
      collaboration={
        autosave.document ? (
          <DwaionArtifactCollaboration
            document={autosave.document}
            capabilities={collaboration.capabilities}
            workspace={collaboration.workspace}
            preflight={collaboration.preflight}
            latestShare={collaboration.latestShare}
            accessRequest={collaboration.accessRequest}
            loading={collaboration.loading}
            busy={collaboration.busy || collaborationDraftMutation.isPending}
            error={collaboration.error}
            canEdit={canEdit && selectionAvailable}
            canPublish={canPublish && selectionAvailable}
            locale={locale}
            onRetry={collaboration.retry}
            onRunPreflight={collaboration.runPreflight}
            onCreateWorkspace={collaboration.createWorkspace}
            onUpdateMembers={collaboration.updateMembers}
            onSyncEdit={collaboration.syncEdit}
            onResolveConflict={collaboration.resolveConflict}
            onCreateShare={collaboration.createShare}
            onRevokeShare={collaboration.revokeShare}
            onRequestAccess={collaboration.requestAccess}
            onSaveExplanation={(explanation) =>
              collaborationDraftMutation.mutateAsync({ explanation })
            }
            onSavePrivateDraft={() => collaborationDraftMutation.mutateAsync({})}
            onResubmit={collaboration.resubmit}
          />
        ) : null
      }
      comments={
        autosave.document ? (
          <DwaionArtifactInlineComments
            capability={collaboration.capabilities?.inlineComments ?? null}
            workspaceAvailable={Boolean(collaboration.workspace)}
            comments={collaboration.comments}
            loading={collaboration.commentsLoading}
            busy={collaboration.busy}
            error={collaboration.commentsError}
            canEdit={canEdit && selectionAvailable}
            locale={locale}
            formatTimestamp={(value) =>
              formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale)
            }
            onRetry={collaboration.retry}
            onCreate={collaboration.createComment}
            onReply={collaboration.replyComment}
            onResolve={collaboration.resolveComment}
          />
        ) : null
      }
      navigationCapabilities={{
        teamWorkspaceAvailable: Boolean(
          collaboration.capabilities?.providerState === 'AVAILABLE' &&
          collaboration.capabilities.teamWorkspaceAvailable
        ),
        teamWorkspaceReason: collaboration.capabilities?.recoveryHint,
        teamArtifactIds: collaboration.workspace ? [collaboration.workspace.artifactId] : [],
        reviewRequestsAvailable: Boolean(
          (collaboration.capabilities?.reviewNotification.available &&
            collaboration.capabilities.reviewNotification.configured) ||
          (collaboration.capabilities?.reviewRejection.available &&
            collaboration.capabilities.reviewRejection.configured)
        ),
        reviewRequestsReason:
          collaboration.capabilities?.reviewNotification.recoveryHint ??
          collaboration.capabilities?.reviewNotification.reasonCode ??
          collaboration.capabilities?.reviewRejection.recoveryHint ??
          collaboration.capabilities?.reviewRejection.reasonCode,
      }}
    />
  );
}

function retryGovernedQuery(failureCount: number, error: Error): boolean {
  return (
    !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && failureCount < 1
  );
}

function toSummary(artifact: DwaionGovernedArtifact) {
  return {
    artifactId: artifact.artifactId,
    title: artifact.content.title,
    artifactType: artifact.artifactType,
    state: artifact.state,
    revision: artifact.revision,
    draftRevision: artifact.draftRevision,
    currentVersionNumber: artifact.currentVersionNumber,
    publishedVersionNumber: artifact.publishedVersionNumber ?? null,
    updatedAt: artifact.updatedAt,
    capabilities: toCapabilities(artifact),
  } as const;
}

function toDocument(
  artifact: DwaionGovernedArtifact,
  autosaveState: DwaionArtifactDocument['autosaveState']
): DwaionArtifactDocument {
  return {
    ...toSummary(artifact),
    body: artifact.content.body,
    format: 'MARKDOWN',
    sources: artifact.sources,
    autosaveState,
    lastSavedAt: artifact.updatedAt,
  };
}

function toCapabilities(artifact: DwaionGovernedArtifact) {
  return {
    collaborativeEditingAvailable: artifact.capabilities?.collaborativeEditingAvailable ?? false,
    enterpriseDlpConnectorAvailable:
      artifact.capabilities?.enterpriseDlpConnectorAvailable ?? false,
    externalSharingAvailable: artifact.capabilities?.externalSharingAvailable ?? false,
    immutableVersionsAvailable: artifact.capabilities?.immutableVersionsAvailable ?? false,
    deterministicPreflightAvailable:
      artifact.capabilities?.deterministicPreflightAvailable ?? false,
    sourceVerificationAvailable: artifact.capabilities?.sourceVerificationAvailable ?? false,
    sourceFreshnessAvailable: artifact.capabilities?.sourceFreshnessAvailable ?? false,
    personalPublishStateAvailable: artifact.capabilities?.personalPublishStateAvailable ?? false,
    recipientSharingAvailable: artifact.capabilities?.recipientSharingAvailable ?? false,
    exportRequestAvailable: artifact.capabilities?.exportRequestAvailable ?? false,
    exportExecutionAvailable: artifact.capabilities?.exportExecutionAvailable ?? false,
    versionRestoreAvailable: artifact.capabilities?.versionRestoreAvailable ?? false,
  };
}

function toVersionSummary(version: DwaionArtifactVersionSummary): DwaionArtifactVersion {
  return {
    artifactId: version.artifactId,
    versionNumber: version.versionNumber,
    contentFingerprint: version.contentFingerprint,
    sourceCount: version.sourceCount,
    createdAt: version.createdAt,
    immutable: true,
  };
}

function toVersionDetail(version: DwaionArtifactVersionDetail): DwaionArtifactVersion {
  return {
    ...toVersionSummary(version),
    content: version.content,
    sourceEvidence: version.sourceEvidence.map((item) => ({
      evidenceId: `${item.source.sourceType}:${item.source.reference}`,
      sourceType: item.source.sourceType,
      reference: item.source.reference,
      verificationState: 'UNVERIFIED',
      freshness: 'UNKNOWN',
      verifiedAt: item.verifiedAt ?? null,
    })),
  };
}

function toPreflight(receipt: DwaionArtifactPreflightReceipt): DwaionDlpPreflight {
  return {
    preflightId: receipt.preflightId,
    artifactId: receipt.artifactId,
    artifactRevision: receipt.artifactRevision,
    versionNumber: receipt.versionNumber,
    outcome: receipt.outcome,
    current: receipt.current,
    findings: receipt.findings,
    evaluatedAt: receipt.evaluatedAt,
    expiresAt: receipt.expiresAt,
    publishAllowed: receipt.publishAllowed,
    exportAllowed: receipt.exportAllowed,
  };
}

function toEvidence(source: DwaionArtifactDocument['sources'][number]): DwaionArtifactEvidence {
  return {
    evidenceId: `${source.sourceType}:${source.reference}`,
    sourceType: source.sourceType,
    reference: source.reference,
    verificationState: 'UNVERIFIED',
    freshness: 'UNKNOWN',
    verifiedAt: null,
  };
}

function isAccessDenied(error: unknown): boolean {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}
