import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  formatDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import {
  archiveDwaionRoutine,
  changeDwaionRoutineConsent,
  changeDwaionRoutineLifecycle,
  createDwaionRoutine,
  dryRunDwaionRoutine,
  getDwaionPersonalAiControls,
  getDwaionRoutines,
  HttpError,
  updateDwaionRoutine,
  useAuth,
  usePermissions,
  useToast,
  type DwaionPersonalRoutine,
  type DwaionRoutineDefinition,
  type DwaionRoutineDryRunReceipt as ApiDryRunReceipt,
  type DwaionRoutineLifecycleAction,
} from '@dwp-frontend/shared-utils';

import { DWAION_ROUTINE_COPY_EN, DWAION_ROUTINE_COPY_KO } from './routines/dwaion-routine-copy';
import { DwaionRoutineEditorDialog } from './routines/dwaion-routine-editor-dialog';
import { createEmptyRoutineDraft } from './routines/dwaion-routine-model';
import { DwaionRoutinesPage } from './routines/dwaion-routines-page';

import type { DwaionRoutineSourceOption } from './routines/dwaion-routine-editor-dialog';
import type {
  DwaionRoutine,
  DwaionRoutineDraft,
  DwaionRoutineDryRunReceipt,
} from './routines/dwaion-routine-model';

const ROUTINES_KEY = ['dwaion', 'personal-routines'] as const;
const CONTROLS_KEY = ['dwaion', 'personal-ai-controls'] as const;
const CONSENT_KEYS = ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'] as const;

export function DwaionRoutines() {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = locale === 'ko' ? DWAION_ROUTINE_COPY_KO : DWAION_ROUTINE_COPY_EN;
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const identity = `${user?.tenantId ?? ''}:${user?.userId ?? ''}`;
  const canView = isAuthenticated && isLoaded && hasPermission('APP.DWAION_ROUTINES', 'VIEW');
  const canManage = canView && hasPermission('APP.DWAION_ROUTINES', 'MANAGE');
  const canReadControls = isAuthenticated && isLoaded && hasPermission('APP.DWAION_MEMORY', 'VIEW');
  const currentTimeZone = resolveSystemTimeZone('UTC');

  const routinesQuery = useQuery({
    queryKey: [...ROUTINES_KEY, identity],
    queryFn: getDwaionRoutines,
    enabled: canView,
    staleTime: 15_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const controlsQuery = useQuery({
    queryKey: [...CONTROLS_KEY, identity],
    queryFn: getDwaionPersonalAiControls,
    enabled: canReadControls,
    staleTime: 15_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });

  const routines = useMemo(() => (routinesQuery.data ?? []).map(toRoutine), [routinesQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const effectiveSelectedId =
    selectedId === null
      ? undefined
      : routines.some((routine) => routine.routineId === selectedId)
        ? selectedId
        : routines[0]?.routineId;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DwaionRoutineDraft>(() =>
    createEmptyRoutineDraft(currentTimeZone)
  );
  const [dryRunReceipt, setDryRunReceipt] = useState<DwaionRoutineDryRunReceipt | null>(null);
  const [commandError, setCommandError] = useState<
    'REVISION_CONFLICT' | 'COMMAND_FAILED' | undefined
  >();

  const saveMutation = useMutation({
    mutationFn: async (input: { routineId: string | null; draft: DwaionRoutineDraft }) => {
      const existing = input.routineId
        ? routinesQuery.data?.find((routine) => routine.routineId === input.routineId)
        : undefined;
      let routine = existing
        ? await updateDwaionRoutine(
            existing.routineId,
            existing.revision,
            toDefinition(input.draft, locale)
          )
        : await createDwaionRoutine(toDefinition(input.draft, locale));

      for (const key of CONSENT_KEYS) {
        if (routineConsentValue(routine, key) !== 'ENABLED') {
          routine = await changeDwaionRoutineConsent(
            routine.routineId,
            routine.revision,
            key,
            'ENABLED'
          );
        }
      }
      return routine;
    },
    onSuccess: async (routine) => {
      setEditorOpen(false);
      setEditingId(null);
      setSelectedId(routine.routineId);
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
      toast.success(copy.saved);
    },
    onError: handleCommandError,
  });
  const lifecycleMutation = useMutation({
    mutationFn: (input: {
      routineId: string;
      expectedRevision: number;
      action: DwaionRoutineLifecycleAction;
    }) => changeDwaionRoutineLifecycle(input.routineId, input.expectedRevision, input.action),
    onSuccess: async () => {
      setDryRunReceipt(null);
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
      toast.success(copy.lifecycleSaved);
    },
    onError: handleCommandError,
  });
  const dryRunMutation = useMutation({
    mutationFn: (input: { routineId: string; expectedRevision: number }) =>
      dryRunDwaionRoutine(input.routineId, input.expectedRevision),
    onSuccess: (receipt) => {
      setDryRunReceipt(toDryRunReceipt(receipt));
      setCommandError(undefined);
      toast.success(copy.validationComplete);
    },
    onError: handleCommandError,
  });
  const archiveMutation = useMutation({
    mutationFn: (input: { routineId: string; expectedRevision: number }) =>
      archiveDwaionRoutine(input.routineId, input.expectedRevision),
    onSuccess: async () => {
      setDryRunReceipt(null);
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
      toast.success(copy.archived);
    },
    onError: handleCommandError,
  });

  function handleCommandError(error: Error) {
    const conflict = error instanceof HttpError && error.status === 409;
    setCommandError(conflict ? 'REVISION_CONFLICT' : 'COMMAND_FAILED');
    void queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
    toast.error(conflict ? copy.revisionConflict : copy.commandFailed);
  }

  const sourceOptions: DwaionRoutineSourceOption[] = (
    ['WORK_ITEM', 'MAIL', 'CALENDAR'] as const
  ).map((sourceKey) => {
    const preference = controlsQuery.data?.sourcePreferences?.find(
      (item) => item.sourceKey === sourceKey
    );
    return {
      key: sourceKey,
      label: copy.sourceLabels[sourceKey],
      description: preference?.retention,
      available: Boolean(preference?.available && preference.effective),
    };
  });
  const busy =
    saveMutation.isPending ||
    lifecycleMutation.isPending ||
    dryRunMutation.isPending ||
    archiveMutation.isPending;
  const canConfigure = canManage && controlsQuery.isSuccess;
  const accessDenied =
    !canView ||
    (routinesQuery.error instanceof HttpError && [401, 403].includes(routinesQuery.error.status));
  const state = !isLoaded
    ? 'loading'
    : accessDenied
      ? 'permission-denied'
      : routinesQuery.isPending
        ? 'loading'
        : routinesQuery.isError
          ? 'error'
          : 'ready';

  const openCreate = () => {
    setEditingId(null);
    setDraft(createEmptyRoutineDraft(currentTimeZone));
    setEditorOpen(true);
  };
  const openEdit = (routine: DwaionRoutine) => {
    setEditingId(routine.routineId);
    setDraft(toDraft(routine));
    setEditorOpen(true);
  };

  return (
    <>
      <DwaionRoutinesPage
        state={state}
        routines={routines}
        selectedId={effectiveSelectedId}
        partialError={controlsQuery.isError ? copy.partial : undefined}
        commandError={commandError}
        dryRunReceipt={dryRunReceipt}
        busy={busy}
        canManage={canManage}
        canCreate={canConfigure}
        onRetry={() => void Promise.all([routinesQuery.refetch(), controlsQuery.refetch()])}
        onCreate={openCreate}
        onSelect={(routine) => setSelectedId(routine.routineId)}
        onCloseSelection={() => setSelectedId(null)}
        onDryRun={(routineId, expectedRevision) =>
          dryRunMutation.mutate({ routineId, expectedRevision })
        }
        onEdit={openEdit}
        onSetLifecycle={(routineId, expectedRevision, action) =>
          lifecycleMutation.mutate({ routineId, expectedRevision, action })
        }
        onArchive={(routineId, expectedRevision) =>
          archiveMutation.mutate({ routineId, expectedRevision })
        }
        copy={copy}
        formatTimestamp={(value) =>
          formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale)
        }
      />
      <DwaionRoutineEditorDialog
        open={editorOpen}
        draft={draft}
        sourceOptions={sourceOptions}
        timeZoneOptions={[...new Set([currentTimeZone, 'UTC'])]}
        busy={saveMutation.isPending}
        onDraftChange={setDraft}
        onClose={() => setEditorOpen(false)}
        onSubmit={(nextDraft) =>
          saveMutation.mutateAsync({ routineId: editingId, draft: nextDraft }).then(() => undefined)
        }
        copy={copy}
      />
    </>
  );
}

function retryGovernedQuery(failureCount: number, error: Error): boolean {
  return (
    !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && failureCount < 1
  );
}

function toDefinition(draft: DwaionRoutineDraft, locale: 'ko' | 'en'): DwaionRoutineDefinition {
  return {
    name: draft.title.trim(),
    objective: draft.description.trim(),
    cadence: draft.schedule.cadence,
    localTime: draft.schedule.localTime,
    timeZone: draft.schedule.timeZone,
    locale,
    activeFrom: draft.schedule.activeFrom,
    activeUntil: draft.schedule.activeUntil,
    quietHoursStart: draft.schedule.quietHoursStart,
    quietHoursEnd: draft.schedule.quietHoursEnd,
    weekDays: [...draft.schedule.weekDays],
    sources: [...draft.sourceKeys] as DwaionRoutineDefinition['sources'],
  };
}

function toRoutine(routine: DwaionPersonalRoutine): DwaionRoutine {
  return {
    routineId: routine.routineId,
    title: routine.definition.name,
    description: routine.definition.objective,
    status: routine.lifecycleState,
    revision: routine.revision,
    executionMode: 'DRY_RUN_ONLY',
    sourceKeys: routine.definition.sources,
    schedule: {
      cadence: routine.definition.cadence,
      localTime: routine.definition.localTime,
      timeZone: routine.definition.timeZone,
      activeFrom: routine.definition.activeFrom ?? null,
      activeUntil: routine.definition.activeUntil ?? null,
      quietHoursStart: routine.definition.quietHoursStart ?? null,
      quietHoursEnd: routine.definition.quietHoursEnd ?? null,
      weekDays: routine.definition.weekDays ?? [],
    },
    consents: [
      { key: 'SOURCE_ACCESS', state: routine.consents.sourceAccess },
      { key: 'ANALYSIS', state: routine.consents.analysis },
      { key: 'PROPOSAL_DELIVERY', state: routine.consents.proposalDelivery },
    ],
    schedulingAvailable: routine.schedulingAvailable,
    dryRunAvailable: routine.capabilities?.dryRunAvailable ?? true,
    proposalDeliveryAvailable: routine.capabilities?.proposalDeliveryAvailable ?? false,
  };
}

function toDraft(routine: DwaionRoutine): DwaionRoutineDraft {
  return {
    title: routine.title,
    description: routine.description,
    sourceKeys: routine.sourceKeys,
    schedule: routine.schedule,
    consentKeys: routine.consents
      .filter((consent) => consent.state === 'ENABLED')
      .map((consent) => consent.key),
  };
}

function routineConsentValue(routine: DwaionPersonalRoutine, key: (typeof CONSENT_KEYS)[number]) {
  if (key === 'SOURCE_ACCESS') return routine.consents.sourceAccess;
  if (key === 'ANALYSIS') return routine.consents.analysis;
  return routine.consents.proposalDelivery;
}

function toDryRunReceipt(receipt: ApiDryRunReceipt): DwaionRoutineDryRunReceipt {
  return {
    routineId: receipt.routineId,
    routineRevision: receipt.routineRevision,
    evaluatedAt: receipt.evaluatedAt,
    outcome: 'VALIDATED',
    evidenceCount: receipt.evidenceCount,
    evidenceScope: 'AUTHORIZED_SOURCE_BINDING',
    businessEvidenceCount: receipt.businessEvidenceCount,
    proposalsCreated: receipt.proposalsCreated,
    validatedSources: receipt.validatedSources,
    previewNextRunAt: receipt.previewNextRunAt,
    schedulingAvailable: false,
  };
}
