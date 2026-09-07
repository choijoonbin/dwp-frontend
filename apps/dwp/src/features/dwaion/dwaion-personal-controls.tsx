import { useMemo, useState } from 'react';
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
  getDwaionPersonalMemories,
  getDwaionRetentionPolicies,
  HttpError,
  requestDwaionPersonalDataDeletion,
  updateDwaionMemoryPreference,
  updateDwaionPersonalMemory,
  updateDwaionSourcePreference,
  useAuth,
  usePermissions,
  useToast,
  type DwaionAiSourceKey,
  type DwaionDeletionDomain,
  type DwaionPersonalMemory,
} from '@dwp-frontend/shared-utils';

import { DwaionPersonalAiControls } from './personal-controls/dwaion-personal-ai-controls';
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

  const [commandError, setCommandError] = useState<
    'REVISION_CONFLICT' | 'COMMAND_FAILED' | undefined
  >();
  const [clearEvidence, setClearEvidence] = useState<readonly DwaionClearEvidence[]>([]);
  const [clearPartialError, setClearPartialError] = useState<string>();

  const preferenceMutation = useMutation({
    mutationFn: (input: { expectedRevision: number; enabled: boolean }) =>
      updateDwaionMemoryPreference(input.expectedRevision, input.enabled ? 'ENABLED' : 'DISABLED'),
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
    }) => updateDwaionSourcePreference(input.sourceKey, input.expectedRevision, input.enabled),
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
        ? updateDwaionPersonalMemory(input.memoryId, input.expectedRevision, input.draft.value)
        : createDwaionPersonalMemory(input.draft.kind, input.draft.value),
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
      state: Exclude<DwaionMemoryState, 'DELETED'>;
    }) => changeDwaionPersonalMemoryState(input.memoryId, input.expectedRevision, input.state),
    onSuccess: async () => {
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: MEMORIES_KEY });
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const deleteMutation = useMutation({
    mutationFn: (input: { memoryId: string; expectedRevision: number }) =>
      deleteDwaionPersonalMemory(input.memoryId, input.expectedRevision),
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
          const job = await requestDwaionPersonalDataDeletion(domains);
          evidence.push({
            kind: 'DELETION_REQUEST',
            receiptId: job.deletionJobId,
            requestedAt: job.requestedAt,
            state: job.state,
            scopes: job.domains,
            deletionPerformed: job.deletionPerformed,
            deletionExecutionAvailable: job.deletionExecutionAvailable,
            blockedScopes: job.blockedDomains ?? [],
          });
        } catch {
          failed.push(...domains);
        }
      }
      if (scopes.includes('PROPOSALS')) {
        try {
          const receipt = await clearDwaionProposalInbox();
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
      ]);
      if (failed.length) toast.error(copy.partial);
      else toast.success(copy.saved);
    },
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

  const memoryRecords = useMemo(
    () =>
      (memories.data ?? [])
        .filter((item) => item.state !== 'DELETED')
        .map((item) => toMemoryRecord(item, copy.memoryKinds[item.kind])),
    [copy.memoryKinds, memories.data]
  );
  const sourcePreferences = useMemo(
    () =>
      (controls.data?.sourcePreferences ?? []).map((preference) => ({
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
    [controls.data?.sourcePreferences, copy]
  );
  const availableClearScopes = useMemo(() => {
    const values: DwaionClearScope[] = ['PROPOSALS'];
    if (canManagePrivacy && capabilities.data?.deletionRequestAvailable) {
      values.push(...(capabilities.data.supportedDeletionDomains ?? []));
    }
    return values;
  }, [canManagePrivacy, capabilities.data]);
  const memoryAccessDenied =
    canViewMemory &&
    controls.error instanceof HttpError &&
    [401, 403].includes(controls.error.status);
  const privacyAccessDenied =
    canViewPrivacy &&
    [capabilities.error, retention.error].some(
      (error) => error instanceof HttpError && [401, 403].includes(error.status)
    );
  const primaryPending = canViewMemory
    ? controls.isPending
    : canViewPrivacy && (capabilities.isPending || retention.isPending);
  const primaryError = canViewMemory
    ? controls.isError && !memoryAccessDenied
    : canViewPrivacy && capabilities.isError && retention.isError && !privacyAccessDenied;
  const state = !isLoaded
    ? 'loading'
    : !canOpen || memoryAccessDenied || privacyAccessDenied
      ? 'permission-denied'
      : primaryPending
        ? 'loading'
        : primaryError
          ? 'error'
          : 'ready';
  const memoryBusy =
    preferenceMutation.isPending ||
    memoryMutation.isPending ||
    memoryStateMutation.isPending ||
    deleteMutation.isPending;
  const partialError =
    clearPartialError ||
    ((canViewMemory && memories.isError) ||
    (canViewPrivacy && (retention.isError || capabilities.isError))
      ? copy.partial
      : undefined);

  return (
    <DwaionPersonalAiControls
      state={state}
      memoryPreference={
        controls.data
          ? {
              state: controls.data.memoryState,
              enabled: controls.data.memoryEnabled,
              effective: controls.data.memoryEffective,
              revision: controls.data.revision,
              storageAvailable: controls.data.explicitMemoryStorageAvailable,
              runtimeApplicationAvailable: controls.data.runtimeApplicationAvailable,
            }
          : null
      }
      sourcePreferences={sourcePreferences}
      memories={memoryRecords}
      retention={(retention.data ?? []).map((item) => ({
        domain: item.domain,
        retentionDays: item.retentionDays,
        deletionGraceDays: item.deletionGraceDays,
        legalHold: item.legalHold,
        revision: item.revision,
      }))}
      availableClearScopes={availableClearScopes}
      partialError={partialError}
      commandError={commandError}
      busySourceKeys={sourceMutation.isPending ? [sourceMutation.variables.sourceKey] : []}
      memoryBusy={memoryBusy}
      clearing={clearMutation.isPending}
      clearEvidence={clearEvidence}
      canManage={canManage}
      canViewMemory={canViewMemory}
      canManagePrivacy={canManagePrivacy}
      onRetry={() =>
        void Promise.all([
          ...(canViewMemory ? [controls.refetch(), memories.refetch()] : []),
          ...(canViewPrivacy ? [capabilities.refetch(), retention.refetch()] : []),
        ])
      }
      onMemoryPreferenceChange={(expectedRevision, enabled) =>
        preferenceMutation.mutate({ expectedRevision, enabled })
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
    state: memory.state,
    revision: memory.revision,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}
