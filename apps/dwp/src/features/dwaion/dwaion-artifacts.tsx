import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useDwaionArtifactAutosave } from './artifact-studio/use-dwaion-artifact-autosave';

import type { DwaionArtifactExportFormat as UiExportFormat } from './artifact-studio/dwaion-artifact-export-dialog';
import type {
  DwaionArtifactDocument,
  DwaionArtifactEvidence,
  DwaionArtifactExportEvidence,
  DwaionArtifactType,
  DwaionArtifactVersion,
  DwaionDlpPreflight,
} from './artifact-studio/dwaion-artifact-model';

const ARTIFACTS_KEY = ['dwaion', 'governed-artifacts'] as const;

export function DwaionArtifacts() {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = locale === 'ko' ? DWAION_ARTIFACT_COPY_KO : DWAION_ARTIFACT_COPY_EN;
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
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
  const [selectedId, setSelectedId] = useState<string>();
  const effectiveSelectedId = artifactsQuery.data?.some(
    (artifact) => artifact.artifactId === selectedId
  )
    ? selectedId
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

  const [commandError, setCommandError] = useState<
    'REVISION_CONFLICT' | 'COMMAND_FAILED' | undefined
  >();
  const [exportReceipt, setExportReceipt] = useState<DwaionArtifactExportEvidence | null>(null);

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
      const saved = await autosaveDwaionArtifact(
        artifactId,
        expectedRevision,
        { ...content, format: 'MARKDOWN' },
        [...sources]
      );
      queryClient.setQueryData([...ARTIFACTS_KEY, 'detail', identity, artifactId], saved);
      void queryClient.invalidateQueries({ queryKey: [...ARTIFACTS_KEY, identity] });
      setCommandError(undefined);
      return toDocument(saved, 'SAVED');
    },
    [identity, queryClient]
  );

  const serverArtifact =
    detailQuery.data ??
    artifactsQuery.data?.find((artifact) => artifact.artifactId === effectiveSelectedId) ??
    null;
  const serverDocument = serverArtifact ? toDocument(serverArtifact, 'IDLE') : null;
  const autosave = useDwaionArtifactAutosave({
    serverDocument,
    save: saveArtifact,
    onError: handleCommandError,
  });

  const createMutation = useMutation({
    mutationFn: (input: { artifactType: DwaionArtifactType; title: string; body: string }) =>
      createDwaionArtifact({
        artifactType: input.artifactType,
        content: { title: input.title, body: input.body, format: 'MARKDOWN' },
        sources: [],
      }),
    onSuccess: async (artifact) => {
      setSelectedId(artifact.artifactId);
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY });
      toast.success(copy.save);
    },
    onError: handleCommandError,
  });
  const preflightMutation = useMutation({
    mutationFn: async (artifact: DwaionArtifactDocument) => {
      const version = await createDwaionArtifactVersion(artifact.artifactId, artifact.revision);
      return runDwaionArtifactPreflight(
        artifact.artifactId,
        version.artifactRevision,
        version.versionNumber
      );
    },
    onSuccess: async (receipt) => {
      setCommandError(undefined);
      queryClient.setQueryData(
        [...ARTIFACTS_KEY, 'preflight', identity, receipt.artifactId],
        receipt
      );
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
      publishDwaionArtifact(
        input.artifact.artifactId,
        input.artifact.revision,
        input.preflight.versionNumber,
        input.preflight.preflightId
      ),
    onSuccess: async (receipt) => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY });
      toast.success(copy.publish);
      setSelectedId(receipt.artifactId);
    },
    onError: handleCommandError,
  });
  const exportMutation = useMutation({
    mutationFn: (input: {
      artifact: DwaionArtifactDocument;
      preflight: DwaionDlpPreflight;
      format: UiExportFormat;
    }) =>
      requestDwaionArtifactExport(
        input.artifact.artifactId,
        input.artifact.revision,
        input.preflight.versionNumber,
        input.preflight.preflightId,
        input.format as DwaionArtifactExportFormat
      ),
    onSuccess: async (receipt) => {
      setExportReceipt({
        exportJobId: receipt.exportJobId,
        exportFormat: receipt.exportFormat,
        state: 'PENDING',
        executionAvailable: false,
        fileAvailable: false,
      });
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ARTIFACTS_KEY });
      toast.success(copy.exportReceipt);
    },
    onError: handleCommandError,
  });

  const summaries = useMemo(
    () => (artifactsQuery.data ?? []).map(toSummary),
    [artifactsQuery.data]
  );
  const versions = useMemo(
    () => (versionsQuery.data ?? []).map(toVersionSummary),
    [versionsQuery.data]
  );
  const preflight = preflightQuery.data ? toPreflight(preflightQuery.data) : null;
  const evidence = (autosave.document?.sources ?? []).map(toEvidence);
  const accessDenied =
    !canView ||
    (artifactsQuery.error instanceof HttpError && [401, 403].includes(artifactsQuery.error.status));
  const state = !isLoaded
    ? 'loading'
    : accessDenied
      ? 'permission-denied'
      : artifactsQuery.isPending
        ? 'loading'
        : artifactsQuery.isError
          ? 'error'
          : 'ready';
  const partialError =
    detailQuery.isError || versionsQuery.isError || preflightQuery.isError
      ? copy.partial
      : undefined;

  return (
    <DwaionArtifactStudio
      state={state}
      artifacts={summaries}
      document={autosave.document}
      evidence={evidence}
      versions={versions}
      preflight={preflight}
      exportReceipt={exportReceipt}
      partialError={partialError}
      commandError={commandError}
      canCreate={canCreate}
      canEdit={canEdit}
      canPublish={canPublish}
      canExport={canExport}
      createBusy={createMutation.isPending}
      preflightBusy={preflightMutation.isPending}
      publishBusy={publishMutation.isPending}
      exportBusy={exportMutation.isPending}
      onRetry={() =>
        void Promise.all([
          artifactsQuery.refetch(),
          detailQuery.refetch(),
          versionsQuery.refetch(),
          preflightQuery.refetch(),
        ])
      }
      onCreate={(input) => createMutation.mutateAsync(input).then(() => undefined)}
      onSelect={(artifactId) => {
        setSelectedId(artifactId);
        setExportReceipt(null);
      }}
      onDraftChange={autosave.update}
      onLoadVersion={async (versionNumber) => {
        if (!effectiveSelectedId) throw new Error('Artifact is not selected.');
        return toVersionDetail(await getDwaionArtifactVersion(effectiveSelectedId, versionNumber));
      }}
      onRunPreflight={(artifact) => preflightMutation.mutate(artifact)}
      onPublish={(artifact, receipt) => publishMutation.mutate({ artifact, preflight: receipt })}
      onExport={(artifact, receipt, format) =>
        exportMutation.mutateAsync({ artifact, preflight: receipt, format }).then(() => undefined)
      }
      copy={copy}
      formatTimestamp={(value) =>
        formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale)
      }
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
    immutableVersionsAvailable: artifact.capabilities?.immutableVersionsAvailable ?? true,
    deterministicPreflightAvailable: artifact.capabilities?.deterministicPreflightAvailable ?? true,
    sourceVerificationAvailable: artifact.capabilities?.sourceVerificationAvailable ?? false,
    sourceFreshnessAvailable: artifact.capabilities?.sourceFreshnessAvailable ?? false,
    personalPublishStateAvailable: artifact.capabilities?.personalPublishStateAvailable ?? true,
    recipientSharingAvailable: artifact.capabilities?.recipientSharingAvailable ?? false,
    exportRequestAvailable: artifact.capabilities?.exportRequestAvailable ?? true,
    exportExecutionAvailable: artifact.capabilities?.exportExecutionAvailable ?? false,
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
