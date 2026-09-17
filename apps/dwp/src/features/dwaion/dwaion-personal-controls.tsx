import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  changeDwaionPersonalMemoryState,
  clearDwaionProposalInbox,
  createDwaionPersonalMemory,
  deleteDwaionPersonalMemory,
  getDwaionPersonalAiControls,
  getDwaionPersonalDataCapabilities,
  getDwaionPersonalDataDeletion,
  getDwaionPersonalDataDeletions,
  getDwaionPersonalMemories,
  getDwaionRetentionPolicies,
  HttpError,
  requestDwaionPersonalDataDeletion,
  retryDwaionPersonalDataDeletion,
  updateDwaionMemoryPreference,
  updateDwaionMemoryRuntimePreference,
  updateDwaionPersonalMemory,
  updateDwaionSourcePreference,
  useAuth,
  usePermissions,
  useToast,
  type DwaionAiSourceKey,
  type DwaionDeletionDomain,
  type DwaionDeletionJob,
  type DwaionMemoryScope,
  type DwaionPersonalMemory,
} from '@dwp-frontend/shared-utils';

import { deletionStatusPollInterval } from './personal-controls/dwaion-personal-controls-model';
import { DwaionPersonalAiControls } from './personal-controls/dwaion-personal-ai-controls';
import { DwaionDeletionHistory } from './personal-controls/dwaion-deletion-history';
import {
  DWAION_PERSONAL_CONTROLS_COPY_EN,
  DWAION_PERSONAL_CONTROLS_COPY_KO,
} from './personal-controls/dwaion-personal-controls-copy';

import type {
  DwaionClearEvidence,
  DwaionClearScope,
  DwaionMemoryDraft,
  DwaionMemoryRecord,
  DwaionMemoryState,
} from './personal-controls/dwaion-personal-controls-model';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

const CONTROLS_KEY = ['dwaion', 'personal-ai-controls'] as const;
const MEMORIES_KEY = ['dwaion', 'personal-ai-memories'] as const;
const PRIVACY_KEY = ['dwaion', 'personal-data-governance'] as const;

export function DwaionPersonalControls() {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy =
    locale === 'ko' ? DWAION_PERSONAL_CONTROLS_COPY_KO : DWAION_PERSONAL_CONTROLS_COPY_EN;
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const governMemoryPreference = useDwaionGovernedMutation(
    'route.dwaion.work.memory-preference-update.action'
  );
  const governMemoryRuntime = useDwaionGovernedMutation(
    'route.dwaion.work.memory-runtime-update.action'
  );
  const governSourcePreference = useDwaionGovernedMutation(
    'route.dwaion.work.source-preference-update.action'
  );
  const governMemoryCreate = useDwaionGovernedMutation('route.dwaion.work.memory-create.action');
  const governMemoryUpdate = useDwaionGovernedMutation('route.dwaion.work.memory-update.action');
  const governMemoryState = useDwaionGovernedMutation('route.dwaion.work.memory-state.action');
  const governMemoryDelete = useDwaionGovernedMutation('route.dwaion.work.memory-delete.action');
  const governDeletion = useDwaionGovernedMutation(
    'route.dwaion.work.personal-deletion-request.action'
  );
  const governDeletionRetry = useDwaionGovernedMutation(
    'route.dwaion.work.personal-deletion-retry.action'
  );
  const governProposalClear = useDwaionGovernedMutation('route.dwaion.work.proposal-clear.action');
  const identity = `${user?.tenantId ?? ''}:${user?.userId ?? ''}`;
  const canViewMemory = isAuthenticated && isLoaded && hasPermission('APP.DWAION_MEMORY', 'VIEW');
  const canManage = canViewMemory && hasPermission('APP.DWAION_MEMORY', 'MANAGE');
  const canViewPrivacy = isAuthenticated && isLoaded && hasPermission('APP.DWAION_PRIVACY', 'VIEW');
  const canManagePrivacy = canViewPrivacy && hasPermission('APP.DWAION_PRIVACY', 'MANAGE');
  const canOpen = canViewMemory || canViewPrivacy;

  const controls = useQuery({
    queryKey: [...CONTROLS_KEY, identity],
    queryFn: getDwaionPersonalAiControls,
    enabled: canViewMemory,
    staleTime: 15_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const memories = useQuery({
    queryKey: [...MEMORIES_KEY, identity],
    queryFn: getDwaionPersonalMemories,
    enabled: canViewMemory,
    staleTime: 15_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const capabilities = useQuery({
    queryKey: [...PRIVACY_KEY, 'capabilities', identity],
    queryFn: getDwaionPersonalDataCapabilities,
    enabled: canViewPrivacy,
    staleTime: 60_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const retention = useQuery({
    queryKey: [...PRIVACY_KEY, 'retention', identity],
    queryFn: getDwaionRetentionPolicies,
    enabled: canViewPrivacy,
    staleTime: 60_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const deletionHistory = useQuery({
    queryKey: [...PRIVACY_KEY, 'deletions', identity],
    queryFn: ({ signal }) => getDwaionPersonalDataDeletions(signal),
    enabled: canViewPrivacy,
    staleTime: 10_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });

  const [commandError, setCommandError] = useState<
    'REVISION_CONFLICT' | 'COMMAND_FAILED' | undefined
  >();
  const [clearEvidence, setClearEvidence] = useState<readonly DwaionClearEvidence[]>([]);
  const [clearPartialError, setClearPartialError] = useState<string>();
  const deletionRequestIds = useRef(new Map<string, string>());
  const deletionRetryIds = useRef(new Map<string, string>());
  const trackedDeletion = [...clearEvidence]
    .reverse()
    .find(
      (item): item is Extract<DwaionClearEvidence, { kind: 'DELETION_REQUEST' }> =>
        item.kind === 'DELETION_REQUEST'
    );
  const deletionStatus = useQuery({
    queryKey: [...PRIVACY_KEY, 'deletion', identity, trackedDeletion?.receiptId],
    queryFn: () => getDwaionPersonalDataDeletion(trackedDeletion!.receiptId),
    enabled:
      canViewPrivacy &&
      Boolean(trackedDeletion?.deletionExecutionAvailable && trackedDeletion.receiptId),
    refetchInterval: (query) => {
      return deletionStatusPollInterval({
        receiptState: trackedDeletion?.state,
        latestState: query.state.data?.state,
        errorStatus: query.state.error instanceof HttpError ? query.state.error.status : undefined,
      });
    },
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });

  const preferenceMutation = useMutation({
    mutationFn: (input: { expectedRevision: number; enabled: boolean }) =>
      governMemoryPreference((authority) =>
        updateDwaionMemoryPreference(
          input.expectedRevision,
          input.enabled ? 'ENABLED' : 'DISABLED',
          authority
        )
      ),
    onSuccess: (value) => {
      queryClient.setQueryData([...CONTROLS_KEY, identity], value);
      setCommandError(undefined);
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const runtimePreferenceMutation = useMutation({
    mutationFn: (input: { expectedRevision: number; enabled: boolean }) =>
      governMemoryRuntime((authority) =>
        updateDwaionMemoryRuntimePreference(
          input.expectedRevision,
          input.enabled ? 'ENABLED' : 'DISABLED',
          authority
        )
      ),
    onSuccess: (value) => {
      queryClient.setQueryData([...CONTROLS_KEY, identity], value);
      setCommandError(undefined);
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const sourceMutation = useMutation({
    mutationFn: (input: {
      sourceKey: DwaionAiSourceKey;
      expectedRevision: number;
      enabled: boolean;
    }) =>
      governSourcePreference((authority) =>
        updateDwaionSourcePreference(
          input.sourceKey,
          input.expectedRevision,
          input.enabled,
          authority
        )
      ),
    onSuccess: async () => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: CONTROLS_KEY });
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const memoryMutation = useMutation({
    mutationFn: (input: {
      memoryId: string | null;
      expectedRevision: number | null;
      draft: DwaionMemoryDraft;
    }) =>
      input.memoryId && input.expectedRevision !== null
        ? governMemoryUpdate((authority) =>
            updateDwaionPersonalMemory(
              input.memoryId!,
              input.expectedRevision!,
              {
                memory: { value: input.draft.value },
                changeReason:
                  locale === 'ko'
                    ? '사용자가 저장된 선호 내용을 직접 수정했습니다.'
                    : 'The user explicitly updated the saved preference.',
              },
              authority
            )
          )
        : governMemoryCreate((authority) =>
            createDwaionPersonalMemory(
              input.draft.kind,
              input.draft.value,
              { scope: ['ASK'], expiresAt: null },
              authority
            )
          ),
    onSuccess: async () => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: MEMORIES_KEY });
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const memoryBoundaryMutation = useMutation({
    mutationFn: (
      input:
        | {
            kind: 'SCOPE';
            memoryId: string;
            expectedRevision: number;
            scope: readonly DwaionMemoryScope[];
          }
        | {
            kind: 'EXPIRY';
            memoryId: string;
            expectedRevision: number;
            expiresAt: string | null;
          }
    ) =>
      governMemoryUpdate((authority) =>
        updateDwaionPersonalMemory(
          input.memoryId,
          input.expectedRevision,
          input.kind === 'SCOPE'
            ? {
                scope: input.scope,
                changeReason:
                  locale === 'ko'
                    ? '사용자가 메모리 적용 스코프를 직접 축소했습니다.'
                    : 'The user explicitly narrowed the memory application scope.',
              }
            : {
                expiresAt: input.expiresAt,
                changeReason:
                  locale === 'ko'
                    ? '사용자가 메모리 만료일을 직접 재설정했습니다.'
                    : 'The user explicitly reset the memory expiry.',
              },
          authority
        )
      ),
    onSuccess: async () => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: MEMORIES_KEY });
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const memoryStateMutation = useMutation({
    mutationFn: (input: {
      memoryId: string;
      expectedRevision: number;
      state: Extract<DwaionMemoryState, 'ACTIVE' | 'DISABLED'>;
    }) =>
      governMemoryState((authority) =>
        changeDwaionPersonalMemoryState(
          input.memoryId,
          input.expectedRevision,
          input.state,
          authority
        )
      ),
    onSuccess: async () => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: MEMORIES_KEY });
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const deleteMutation = useMutation({
    mutationFn: (input: { memoryId: string; expectedRevision: number }) =>
      governMemoryDelete((authority) =>
        deleteDwaionPersonalMemory(input.memoryId, input.expectedRevision, authority)
      ),
    onSuccess: async () => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: MEMORIES_KEY });
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const clearMutation = useMutation({
    mutationFn: async (scopes: readonly DwaionClearScope[]) => {
      const evidence: DwaionClearEvidence[] = [];
      const failed: DwaionClearScope[] = [];
      const domains = scopes.filter(
        (scope): scope is DwaionDeletionDomain => scope !== 'PROPOSALS'
      );
      if (domains.length) {
        try {
          const key = [...domains].sort().join(':');
          const commandId = deletionRequestIds.current.get(key) ?? globalThis.crypto.randomUUID();
          deletionRequestIds.current.set(key, commandId);
          const job = await governDeletion((authority) =>
            requestDwaionPersonalDataDeletion(domains, authority, commandId)
          );
          deletionRequestIds.current.delete(key);
          evidence.push({
            kind: 'DELETION_REQUEST',
            receiptId: job.deletionJobId,
            requestedAt: job.requestedAt,
            state: job.state,
            scopes: job.domains,
            deletionPerformed: job.deletionPerformed,
            deletionExecutionAvailable: job.deletionExecutionAvailable,
            deletionCompletionClaimAvailable:
              capabilities.data?.deletionCompletionClaimAvailable ?? false,
            blockedScopes: job.blockedDomains ?? [],
            completedAt: job.completedAt ?? null,
          });
        } catch {
          failed.push(...domains);
        }
      }
      if (scopes.includes('PROPOSALS')) {
        try {
          const receipt = await governProposalClear((authority) =>
            clearDwaionProposalInbox(authority)
          );
          evidence.push({
            kind: 'PROPOSAL_CLEAR',
            receiptId: `proposal-clear:${receipt.clearedAt}`,
            completedAt: receipt.clearedAt,
            hiddenCount: receipt.hiddenCount,
            scopes: ['PROPOSALS'],
          });
        } catch {
          failed.push('PROPOSALS');
        }
      }
      return { evidence, failed };
    },
    onSuccess: async ({ evidence, failed }) => {
      setClearEvidence(evidence);
      setClearPartialError(failed.length ? copy.partial : undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'proposals'] }),
        queryClient.invalidateQueries({ queryKey: MEMORIES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'personal-routines'] }),
        queryClient.invalidateQueries({ queryKey: [...PRIVACY_KEY, 'deletions', identity] }),
      ]);
      if (failed.length) toast.error(copy.partial);
      else toast.success(copy.saved);
    },
  });
  const deletionRetryMutation = useMutation({
    mutationFn: (job: DwaionDeletionJob) => {
      const key = `${job.deletionJobId}:${job.attemptCount}`;
      const commandId = deletionRetryIds.current.get(key) ?? globalThis.crypto.randomUUID();
      deletionRetryIds.current.set(key, commandId);
      return governDeletionRetry((authority) =>
        retryDwaionPersonalDataDeletion(job.deletionJobId, job.attemptCount, commandId, authority)
      );
    },
    onSuccess: async (job, requestedJob) => {
      deletionRetryIds.current.delete(`${requestedJob.deletionJobId}:${requestedJob.attemptCount}`);
      queryClient.setQueryData<DwaionDeletionJob[]>(
        [...PRIVACY_KEY, 'deletions', identity],
        (current = []) =>
          [job, ...current.filter((item) => item.deletionJobId !== job.deletionJobId)].sort(
            (left, right) => Date.parse(right.requestedAt) - Date.parse(left.requestedAt)
          )
      );
      setClearEvidence((current) =>
        current.map((item) =>
          item.kind === 'DELETION_REQUEST' && item.receiptId === job.deletionJobId
            ? deletionEvidence(job, capabilities.data?.deletionCompletionClaimAvailable ?? false)
            : item
        )
      );
      toast.success(copy.saved);
      await queryClient.invalidateQueries({
        queryKey: [...PRIVACY_KEY, 'deletions', identity],
      });
    },
    onError: handleCommandError,
  });

  function handleCommandError(error: Error) {
    const conflict = error instanceof HttpError && error.status === 409;
    setCommandError(conflict ? 'REVISION_CONFLICT' : 'COMMAND_FAILED');
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: CONTROLS_KEY }),
      queryClient.invalidateQueries({ queryKey: MEMORIES_KEY }),
    ]);
    toast.error(conflict ? copy.revisionConflict : copy.commandFailed);
  }

  const memoryAccessDenied = [controls.error, memories.error].some(isAccessDenied);
  const privacyAccessDenied = [
    capabilities.error,
    retention.error,
    deletionStatus.error,
    deletionHistory.error,
  ].some(isAccessDenied);
  const memoryAvailable = canViewMemory && !memoryAccessDenied;
  const privacyAvailable = canViewPrivacy && !privacyAccessDenied;
  const memoryReady = memoryAvailable && controls.isSuccess;
  const privacyReady = privacyAvailable && (capabilities.isSuccess || retention.isSuccess);
  const memoryRecords = useMemo(
    () =>
      (memoryAvailable ? (memories.data ?? []) : [])
        .filter((item) => item.state !== 'DELETED')
        .map((item) => toMemoryRecord(item, copy.memoryKinds[item.kind])),
    [copy.memoryKinds, memories.data, memoryAvailable]
  );
  const sourcePreferences = useMemo(
    () =>
      (memoryAvailable ? (controls.data?.sourcePreferences ?? []) : []).map((preference) => ({
        sourceKey: preference.sourceKey,
        label: copy.sourceLabels[preference.sourceKey],
        description: copy.sourceDescriptions[preference.sourceKey],
        enabled: preference.enabled,
        effective: preference.effective,
        available: preference.available,
        revision: preference.revision,
        effectScope: preference.effectScope,
        retentionLabel: preference.retention,
        unavailableReason: preference.available ? undefined : copy.unavailable,
      })),
    [controls.data?.sourcePreferences, copy, memoryAvailable]
  );
  const availableClearScopes = useMemo(() => {
    const values: DwaionClearScope[] = canManage && memoryAvailable ? ['PROPOSALS'] : [];
    if (canManagePrivacy && privacyAvailable && capabilities.data?.deletionRequestAvailable) {
      values.push(...(capabilities.data.supportedDeletionDomains ?? []));
    }
    return values;
  }, [canManage, memoryAvailable, canManagePrivacy, privacyAvailable, capabilities.data]);
  const primaryPending =
    (memoryAvailable && controls.isPending) ||
    (privacyAvailable && (capabilities.isPending || retention.isPending));
  const state = !isLoaded
    ? 'loading'
    : !canOpen || (!memoryAvailable && !privacyAvailable)
      ? 'permission-denied'
      : memoryReady || privacyReady
        ? 'ready'
        : primaryPending
          ? 'loading'
          : 'error';
  const memoryBusy =
    preferenceMutation.isPending ||
    runtimePreferenceMutation.isPending ||
    memoryMutation.isPending ||
    memoryBoundaryMutation.isPending ||
    memoryStateMutation.isPending ||
    deleteMutation.isPending;
  const deletionStatusError =
    canViewPrivacy && deletionStatus.isError ? copy.deletionStatusError : undefined;
  const partialError =
    deletionStatusError ||
    clearPartialError ||
    ((canViewMemory && (controls.isError || memories.isError)) ||
    (canViewPrivacy && (retention.isError || capabilities.isError || deletionHistory.isError))
      ? copy.partial
      : undefined);
  const effectiveClearEvidence = clearEvidence.map((item) => {
    if (
      item.kind !== 'DELETION_REQUEST' ||
      !deletionStatus.data ||
      item.receiptId !== deletionStatus.data.deletionJobId
    ) {
      return item;
    }
    return {
      ...item,
      state: deletionStatus.data.state,
      scopes: deletionStatus.data.domains,
      deletionPerformed: deletionStatus.data.deletionPerformed,
      deletionExecutionAvailable: deletionStatus.data.deletionExecutionAvailable,
      blockedScopes: deletionStatus.data.blockedDomains ?? [],
      completedAt: deletionStatus.data.completedAt ?? null,
    } satisfies DwaionClearEvidence;
  });

  return (
    <DwaionPersonalAiControls
      key={`${identity}:${memoryAvailable}:${privacyAvailable}`}
      state={state}
      memoryPreference={
        memoryAvailable && controls.data
          ? {
              state: controls.data.memoryState,
              enabled: controls.data.memoryEnabled,
              effective: controls.data.memoryEffective,
              runtimeState: controls.data.runtimeApplicationState,
              runtimeEnabled: controls.data.runtimeApplicationEnabled,
              revision: controls.data.revision,
              storageAvailable: controls.data.explicitMemoryStorageAvailable,
              runtimeApplicationAvailable: controls.data.runtimeApplicationAvailable,
              automaticMemoryInference: controls.data.automaticMemoryInference,
              sensitiveMemoryAllowed: controls.data.sensitiveMemoryAllowed,
              backgroundCredentialStorage: controls.data.backgroundCredentialStorage,
              teamMemoryAvailable: controls.data.teamMemoryAvailable,
              externalActionWithoutApproval: controls.data.externalActionWithoutApproval,
              evidenceCapabilities: controls.data.evidenceCapabilities,
            }
          : null
      }
      sourcePreferences={sourcePreferences}
      memories={memoryRecords}
      retention={(privacyAvailable ? (retention.data ?? []) : []).map((item) => ({
        domain: item.domain,
        retentionDays: item.retentionDays,
        deletionGraceDays: item.deletionGraceDays,
        legalHold: item.legalHold,
        revision: item.revision,
      }))}
      availableClearScopes={availableClearScopes}
      partialError={partialError}
      commandError={commandError}
      deletionStatusError={deletionStatusError}
      busySourceKeys={sourceMutation.isPending ? [sourceMutation.variables.sourceKey] : []}
      memoryBusy={memoryBusy}
      clearing={clearMutation.isPending}
      clearEvidence={effectiveClearEvidence.filter((receipt) =>
        receipt.kind === 'PROPOSAL_CLEAR' ? memoryAvailable : privacyAvailable
      )}
      deletionExecutionAvailable={capabilities.data?.deletionExecutionAvailable ?? false}
      deletionCompletionClaimAvailable={
        capabilities.data?.deletionCompletionClaimAvailable ?? false
      }
      auditMetadataMayBeRetained={capabilities.data?.auditMetadataMayBeRetained ?? true}
      deletionHistory={
        privacyAvailable ? (
          <DwaionDeletionHistory
            jobs={deletionHistory.data ?? []}
            capabilities={capabilities.data ?? null}
            loading={deletionHistory.isPending}
            error={deletionHistory.error}
            canManage={canManagePrivacy}
            retryingJobId={deletionRetryMutation.variables?.deletionJobId}
            locale={locale}
            onRefresh={() => void deletionHistory.refetch()}
            onRetry={(job) => deletionRetryMutation.mutate(job)}
            formatTimestamp={(value) =>
              formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale)
            }
          />
        ) : null
      }
      canManage={canManage && memoryAvailable}
      canViewMemory={memoryAvailable}
      canViewPrivacy={privacyAvailable}
      canManagePrivacy={canManagePrivacy && privacyAvailable}
      onRetry={() =>
        void Promise.all([
          ...(canViewMemory ? [controls.refetch(), memories.refetch()] : []),
          ...(canViewPrivacy ? [capabilities.refetch(), retention.refetch()] : []),
          ...(canViewPrivacy ? [deletionHistory.refetch()] : []),
          ...(canViewPrivacy && trackedDeletion ? [deletionStatus.refetch()] : []),
        ])
      }
      onMemoryPreferenceChange={(expectedRevision, enabled) =>
        preferenceMutation.mutate({ expectedRevision, enabled })
      }
      onRuntimePreferenceChange={(expectedRevision, enabled) =>
        runtimePreferenceMutation.mutate({ expectedRevision, enabled })
      }
      onSourcePreferenceChange={(sourceKey, expectedRevision, enabled) =>
        sourceMutation.mutate({
          sourceKey: sourceKey as DwaionAiSourceKey,
          expectedRevision,
          enabled,
        })
      }
      onSaveMemory={(memoryId, expectedRevision, draft) =>
        memoryMutation.mutateAsync({ memoryId, expectedRevision, draft }).then(() => undefined)
      }
      onMemoryStateChange={(memoryId, expectedRevision, memoryState) =>
        memoryStateMutation
          .mutateAsync({ memoryId, expectedRevision, state: memoryState })
          .then(() => undefined)
      }
      onMemoryScopeChange={(memoryId, expectedRevision, scope) =>
        memoryBoundaryMutation
          .mutateAsync({ kind: 'SCOPE', memoryId, expectedRevision, scope })
          .then(() => undefined)
      }
      onMemoryExpiryChange={(memoryId, expectedRevision, expiresAt) =>
        memoryBoundaryMutation
          .mutateAsync({ kind: 'EXPIRY', memoryId, expectedRevision, expiresAt })
          .then(() => undefined)
      }
      onDeleteMemory={(memoryId, expectedRevision) =>
        deleteMutation.mutateAsync({ memoryId, expectedRevision }).then(() => undefined)
      }
      onClear={(scopes) => clearMutation.mutateAsync(scopes).then(() => undefined)}
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

function toMemoryRecord(memory: DwaionPersonalMemory, label: string): DwaionMemoryRecord {
  return {
    memoryId: memory.memoryId,
    kind: memory.kind,
    label,
    value: memory.memory.value,
    origin: memory.origin,
    sourceType: memory.sourceType,
    confidence: memory.confidence ?? null,
    factVector: memory.factVector ?? [],
    useCount: memory.useCount,
    lastUsedAt: memory.lastUsedAt ?? null,
    encryptionProvider: memory.encryptionProvider ?? null,
    encryptionKeyVersion: memory.encryptionKeyVersion ?? null,
    encryptionKeyReferenceFingerprint: memory.encryptionKeyReferenceFingerprint ?? null,
    state: memory.state,
    scope: memory.scope,
    expiresAt: memory.expiresAt,
    revision: memory.revision,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

function isAccessDenied(error: unknown): boolean {
  return error instanceof HttpError && [401, 403].includes(error.status);
}

function deletionEvidence(
  job: DwaionDeletionJob,
  deletionCompletionClaimAvailable: boolean
): Extract<DwaionClearEvidence, { kind: 'DELETION_REQUEST' }> {
  return {
    kind: 'DELETION_REQUEST',
    receiptId: job.deletionJobId,
    requestedAt: job.requestedAt,
    state: job.state,
    scopes: job.domains,
    deletionPerformed: job.deletionPerformed,
    deletionExecutionAvailable: job.deletionExecutionAvailable,
    deletionCompletionClaimAvailable,
    blockedScopes: job.blockedDomains ?? [],
    completedAt: job.completedAt ?? null,
  };
}
