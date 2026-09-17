import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  formatDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import {
  archiveDwaionRoutine,
  changeDwaionRoutineActivation,
  changeDwaionRoutineConsent,
  changeDwaionRoutineLifecycle,
  commandDwaionRoutineRun,
  createDwaionRoutine,
  downloadDwaionRoutineTelemetry,
  dryRunDwaionRoutine,
  getDwaionPersonalAiControls,
  getDwaionRoutineRuntimeCapabilities,
  getDwaionRoutineRuns,
  getDwaionRoutineHealth,
  getDwaionRoutineVersions,
  getDwaionRoutines,
  HttpError,
  newDwaionRoutineCommandId,
  rollbackDwaionRoutineVersion,
  triggerDwaionRoutineWebhook,
  triggerDwaionRoutineRun,
  updateDwaionRoutine,
  useAuth,
  usePermissions,
  useToast,
  type DwaionPersonalRoutine,
  type DwaionRoutineDefinition,
  type DwaionRoutineDryRunReceipt as ApiDryRunReceipt,
  type DwaionRoutineLifecycleAction,
  type DwaionRoutineExecutionRun,
  type DwaionRoutineRunCommand,
  type DwaionRoutineRollbackReceipt,
  type DwaionRoutineVersionSnapshot,
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
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

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
  const governCreate = useDwaionGovernedMutation('route.dwaion.work.routine-create.action');
  const governUpdate = useDwaionGovernedMutation('route.dwaion.work.routine-update.action');
  const governConsent = useDwaionGovernedMutation('route.dwaion.work.routine-consent.action');
  const governLifecycle = useDwaionGovernedMutation('route.dwaion.work.routine-lifecycle.action');
  const governDryRun = useDwaionGovernedMutation('route.dwaion.work.routine-dry-run.action');
  const governArchive = useDwaionGovernedMutation('route.dwaion.work.routine-archive.action');
  const governActivation = useDwaionGovernedMutation('route.dwaion.work.routine-activation.action');
  const governRunTrigger = useDwaionGovernedMutation(
    'route.dwaion.work.routine-run-trigger.action'
  );
  const governRunCommand = useDwaionGovernedMutation(
    'route.dwaion.work.routine-run-command.action'
  );
  const governWebhookTrigger = useDwaionGovernedMutation(
    'route.dwaion.work.routine-webhook-trigger.action'
  );
  const governVersionRollback = useDwaionGovernedMutation(
    'route.dwaion.work.routine-version-rollback.action'
  );
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
  const capabilitiesQuery = useQuery({
    queryKey: ['dwaion', 'routine-runtime-capabilities', identity],
    queryFn: ({ signal }) => getDwaionRoutineRuntimeCapabilities(signal),
    enabled: canView,
    staleTime: 15_000,
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const runsQuery = useQuery({
    queryKey: ['dwaion', 'routine-runs', identity, effectiveSelectedId],
    queryFn: ({ signal }) => getDwaionRoutineRuns(effectiveSelectedId!, 30, signal),
    enabled: canView && Boolean(effectiveSelectedId),
    retry: retryGovernedQuery,
    refetchInterval: (query) =>
      query.state.data?.some((run) =>
        ['QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_SCHEDULED', 'COMPENSATING'].includes(run.state)
      )
        ? 2_500
        : false,
    meta: { accessSensitive: true },
  });
  const versionsQuery = useQuery({
    queryKey: ['dwaion', 'routine-versions', identity, effectiveSelectedId],
    queryFn: ({ signal }) => getDwaionRoutineVersions(effectiveSelectedId!, signal),
    enabled: canView && Boolean(effectiveSelectedId),
    retry: retryGovernedQuery,
    meta: { accessSensitive: true },
  });
  const healthQuery = useQuery({
    queryKey: ['dwaion', 'routine-health', identity, effectiveSelectedId],
    queryFn: ({ signal }) => getDwaionRoutineHealth(effectiveSelectedId!, signal),
    enabled: canView && Boolean(effectiveSelectedId),
    retry: retryGovernedQuery,
    refetchInterval: 30_000,
    meta: { accessSensitive: true },
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DwaionRoutineDraft>(() =>
    createEmptyRoutineDraft(currentTimeZone)
  );
  const [dryRunReceipt, setDryRunReceipt] = useState<DwaionRoutineDryRunReceipt | null>(null);
  const [rollbackReceipt, setRollbackReceipt] = useState<DwaionRoutineRollbackReceipt | null>(null);
  const [commandError, setCommandError] = useState<
    'REVISION_CONFLICT' | 'COMMAND_FAILED' | undefined
  >();
  const commandIds = useRef(new Map<string, string>());
  const webhookEventIds = useRef(new Map<string, string>());
  const webhookOccurredAt = useRef(new Map<string, string>());

  const saveMutation = useMutation({
    mutationFn: async (input: { routineId: string | null; draft: DwaionRoutineDraft }) => {
      const existing = input.routineId
        ? routinesQuery.data?.find((routine) => routine.routineId === input.routineId)
        : undefined;
      let routine = existing
        ? await governUpdate((authority) =>
            updateDwaionRoutine(
              existing.routineId,
              existing.revision,
              toDefinition(input.draft, locale),
              authority
            )
          )
        : await governCreate((authority) =>
            createDwaionRoutine(toDefinition(input.draft, locale), authority)
          );

      for (const key of CONSENT_KEYS) {
        if (routineConsentValue(routine, key) !== 'ENABLED') {
          routine = await governConsent((authority) =>
            changeDwaionRoutineConsent(
              routine.routineId,
              routine.revision,
              key,
              'ENABLED',
              authority
            )
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
    }) =>
      governLifecycle((authority) =>
        changeDwaionRoutineLifecycle(
          input.routineId,
          input.expectedRevision,
          input.action,
          authority
        )
      ),
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
      governDryRun((authority) =>
        dryRunDwaionRoutine(input.routineId, input.expectedRevision, authority)
      ),
    onSuccess: (receipt) => {
      setDryRunReceipt(toDryRunReceipt(receipt));
      setCommandError(undefined);
      toast.success(copy.validationComplete);
    },
    onError: handleCommandError,
  });
  const archiveMutation = useMutation({
    mutationFn: (input: { routineId: string; expectedRevision: number }) =>
      governArchive((authority) =>
        archiveDwaionRoutine(input.routineId, input.expectedRevision, authority)
      ),
    onSuccess: async () => {
      setDryRunReceipt(null);
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
      toast.success(copy.archived);
    },
    onError: handleCommandError,
  });
  const activationMutation = useMutation({
    mutationFn: (input: { routine: DwaionRoutine; action: 'ACTIVATE' | 'DEACTIVATE' }) => {
      const key = `activation:${input.routine.routineId}:${input.routine.revision}:${input.action}`;
      const commandId = commandIds.current.get(key) ?? newDwaionRoutineCommandId();
      commandIds.current.set(key, commandId);
      return governActivation((authority) =>
        changeDwaionRoutineActivation(input.routine.routineId, {
          commandId,
          expectedRevision: input.routine.revision,
          reasonCode:
            input.action === 'ACTIVATE' ? 'USER_CONFIRMED_ACTIVATION' : 'USER_STOPPED_SCHEDULE',
          changeReason:
            locale === 'ko'
              ? input.action === 'ACTIVATE'
                ? '사용자가 실행 예산, 동의 및 복구 정책을 검토하고 예약 실행을 활성화했습니다.'
                : '사용자가 이후 예약 실행을 중지했습니다.'
              : input.action === 'ACTIVATE'
                ? 'The user reviewed budgets, consent, and recovery policy before activation.'
                : 'The user stopped future scheduled executions.',
          action: input.action,
          authority,
        })
      );
    },
    onSuccess: async (_, input) => {
      commandIds.current.delete(
        `activation:${input.routine.routineId}:${input.routine.revision}:${input.action}`
      );
      setCommandError(undefined);
      await queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
      toast.success(input.action === 'ACTIVATE' ? copy.activated : copy.deactivated);
    },
    onError: handleCommandError,
  });
  const triggerRunMutation = useMutation({
    mutationFn: (routine: DwaionRoutine) => {
      const key = `trigger:${routine.triggerType}:${routine.routineId}:${routine.revision}`;
      const commandId = commandIds.current.get(key) ?? newDwaionRoutineCommandId();
      commandIds.current.set(key, commandId);
      if (routine.triggerType === 'WEBHOOK') {
        const eventId = webhookEventIds.current.get(key) ?? crypto.randomUUID();
        webhookEventIds.current.set(key, eventId);
        const occurredAt = webhookOccurredAt.current.get(key) ?? new Date().toISOString();
        webhookOccurredAt.current.set(key, occurredAt);
        return governWebhookTrigger((authority) =>
          triggerDwaionRoutineWebhook(routine.routineId, {
            commandId,
            expectedRevision: routine.revision,
            reasonCode: 'USER_CONFIRMED_WEBHOOK_TEST',
            changeReason:
              locale === 'ko'
                ? '사용자가 등록된 이벤트 유형과 현재 권한을 검토하고 웹훅 실행을 요청했습니다.'
                : 'The user reviewed the registered event type and current authorization before triggering the webhook run.',
            eventId,
            eventType: routine.webhookEventType ?? 'USER.MANUAL_TEST',
            occurredAt,
            payload: { source: 'DWAION_USER_CONSOLE' },
            authority,
          })
        );
      }
      return governRunTrigger((authority) =>
        triggerDwaionRoutineRun(routine.routineId, {
          commandId,
          expectedRevision: routine.revision,
          reasonCode: 'USER_CONFIRMED_MANUAL_RUN',
          changeReason:
            locale === 'ko'
              ? '사용자가 현재 권한과 실행 예산을 검토하고 수동 실행을 요청했습니다.'
              : 'The user reviewed current authorization and budgets and requested a manual run.',
          authority,
        })
      );
    },
    onSuccess: async (run, routine) => {
      const key = `trigger:${routine.triggerType}:${routine.routineId}:${routine.revision}`;
      commandIds.current.delete(key);
      webhookEventIds.current.delete(key);
      webhookOccurredAt.current.delete(key);
      queryClient.setQueryData<DwaionRoutineExecutionRun[]>(
        ['dwaion', 'routine-runs', identity, routine.routineId],
        (current) => [
          run,
          ...(current ?? []).filter((item) => item.routineRunId !== run.routineRunId),
        ]
      );
      setCommandError(undefined);
      toast.success(copy.runTriggered);
    },
    onError: handleCommandError,
  });
  const runCommandMutation = useMutation({
    mutationFn: (input: {
      routine: DwaionRoutine;
      run: DwaionRoutineExecutionRun;
      action: DwaionRoutineRunCommand['action'];
    }) => {
      const key = `run:${input.run.routineRunId}:${input.run.version}:${input.action}`;
      const commandId = commandIds.current.get(key) ?? newDwaionRoutineCommandId();
      commandIds.current.set(key, commandId);
      const reason = routineCommandReason(input.action, locale);
      return governRunCommand((authority) =>
        commandDwaionRoutineRun(input.routine.routineId, input.run.routineRunId, {
          commandId,
          expectedRevision: input.run.version,
          reasonCode: reason.reasonCode,
          changeReason: reason.changeReason,
          action: input.action,
          authority,
        })
      );
    },
    onSuccess: async (run, input) => {
      commandIds.current.delete(
        `run:${input.run.routineRunId}:${input.run.version}:${input.action}`
      );
      queryClient.setQueryData<DwaionRoutineExecutionRun[]>(
        ['dwaion', 'routine-runs', identity, input.routine.routineId],
        (current) =>
          (current ?? []).map((item) => (item.routineRunId === run.routineRunId ? run : item))
      );
      setCommandError(undefined);
      toast.success(copy.runCommandSaved);
    },
    onError: handleCommandError,
  });
  const rollbackMutation = useMutation({
    mutationFn: (input: { routine: DwaionRoutine; version: DwaionRoutineVersionSnapshot }) => {
      const key = `rollback:${input.routine.routineId}:${input.routine.revision}:${input.version.revision}`;
      const commandId = commandIds.current.get(key) ?? newDwaionRoutineCommandId();
      commandIds.current.set(key, commandId);
      return governVersionRollback((authority) =>
        rollbackDwaionRoutineVersion(input.routine.routineId, input.version.revision, {
          commandId,
          expectedRevision: input.routine.revision,
          reasonCode: 'USER_CONFIRMED_VERSION_ROLLBACK',
          changeReason:
            locale === 'ko'
              ? '사용자가 버전 스냅샷과 무결성 지문을 검토하고 새 리비전 롤백을 요청했습니다.'
              : 'The user reviewed the version snapshot and integrity fingerprint before rollback.',
          authority,
        })
      );
    },
    onSuccess: async (receipt, input) => {
      commandIds.current.delete(
        `rollback:${input.routine.routineId}:${input.routine.revision}:${input.version.revision}`
      );
      setRollbackReceipt(receipt);
      setSelectedId(receipt.routineId);
      setCommandError(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ROUTINES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'routine-versions'] }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'routine-health'] }),
      ]);
      toast.success(copy.rollbackComplete);
    },
    onError: handleCommandError,
  });
  const telemetryMutation = useMutation({
    mutationFn: (routine: DwaionRoutine) => downloadDwaionRoutineTelemetry(routine.routineId),
    onSuccess: (blob, routine) => {
      downloadBlob(blob, `routine-${routine.routineId}-telemetry.jsonl`);
      toast.success(copy.telemetryDownloaded);
    },
    onError: () => toast.error(copy.telemetryFailed),
  });

  function handleCommandError(error: Error) {
    const conflict = error instanceof HttpError && error.status === 409;
    if (conflict) {
      setEditorOpen(false);
      setEditingId(null);
    }
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
    archiveMutation.isPending ||
    activationMutation.isPending ||
    triggerRunMutation.isPending ||
    runCommandMutation.isPending ||
    rollbackMutation.isPending ||
    telemetryMutation.isPending;
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
  const editingRoutine = editingId
    ? (routines.find((routine) => routine.routineId === editingId) ?? null)
    : null;

  return (
    <>
      <DwaionRoutinesPage
        state={state}
        routines={routines}
        selectedId={effectiveSelectedId}
        partialError={controlsQuery.isError ? copy.partial : undefined}
        commandError={commandError}
        dryRunReceipt={dryRunReceipt}
        runtimeCapabilities={capabilitiesQuery.data}
        runtimeCapabilitiesError={capabilitiesQuery.isError}
        runs={runsQuery.data ?? []}
        runsLoading={runsQuery.isPending && Boolean(effectiveSelectedId)}
        runsError={runsQuery.isError}
        versions={versionsQuery.data ?? []}
        health={healthQuery.data}
        rollbackReceipt={rollbackReceipt}
        evidenceLoading={
          Boolean(effectiveSelectedId) && (versionsQuery.isPending || healthQuery.isPending)
        }
        evidenceError={versionsQuery.isError || healthQuery.isError}
        busy={busy}
        canManage={canManage}
        canCreate={canConfigure}
        onRetry={() =>
          void Promise.all([
            routinesQuery.refetch(),
            controlsQuery.refetch(),
            capabilitiesQuery.refetch(),
            runsQuery.refetch(),
            versionsQuery.refetch(),
            healthQuery.refetch(),
          ])
        }
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
        onActivate={(routine, action) => activationMutation.mutate({ routine, action })}
        onTriggerRun={(routine) => triggerRunMutation.mutate(routine)}
        onRunCommand={(routine, run, action) => runCommandMutation.mutate({ routine, run, action })}
        onRollbackVersion={(routine, version) => rollbackMutation.mutate({ routine, version })}
        onDownloadTelemetry={(routine) => telemetryMutation.mutate(routine)}
        onRetryRuntime={() =>
          void Promise.all([
            capabilitiesQuery.refetch(),
            runsQuery.refetch(),
            versionsQuery.refetch(),
            healthQuery.refetch(),
          ])
        }
        copy={copy}
        formatTimestamp={(value) =>
          formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale)
        }
      />
      <DwaionRoutineEditorDialog
        open={editorOpen}
        draft={draft}
        savedDraft={editingRoutine ? toDraft(editingRoutine) : null}
        sourceOptions={sourceOptions}
        timeZoneOptions={[...new Set([currentTimeZone, 'UTC'])]}
        capabilities={capabilitiesQuery.data}
        busy={saveMutation.isPending}
        dryRunBusy={dryRunMutation.isPending}
        onDraftChange={setDraft}
        onClose={() => setEditorOpen(false)}
        onSubmit={(nextDraft) =>
          saveMutation
            .mutateAsync({ routineId: editingId, draft: nextDraft })
            .then(() => undefined)
            .catch(() => undefined)
        }
        onDryRun={
          editingRoutine
            ? () =>
                dryRunMutation.mutate({
                  routineId: editingRoutine.routineId,
                  expectedRevision: editingRoutine.revision,
                })
            : undefined
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
    triggerType: draft.triggerType,
    cadence: draft.triggerType === 'SCHEDULED' ? draft.schedule.cadence : null,
    localTime: draft.triggerType === 'SCHEDULED' ? draft.schedule.localTime : null,
    timeZone: draft.triggerType === 'SCHEDULED' ? draft.schedule.timeZone : null,
    webhookEventType: draft.triggerType === 'WEBHOOK' ? draft.webhookEventType.trim() : null,
    webhookEndpointReference:
      draft.triggerType === 'WEBHOOK' && draft.webhookEndpointReference.trim()
        ? draft.webhookEndpointReference.trim()
        : null,
    locale,
    activeFrom: draft.triggerType === 'SCHEDULED' ? draft.schedule.activeFrom : null,
    activeUntil: draft.triggerType === 'SCHEDULED' ? draft.schedule.activeUntil : null,
    quietHoursStart: draft.triggerType === 'SCHEDULED' ? draft.schedule.quietHoursStart : null,
    quietHoursEnd: draft.triggerType === 'SCHEDULED' ? draft.schedule.quietHoursEnd : null,
    weekDays: draft.triggerType === 'SCHEDULED' ? [...draft.schedule.weekDays] : [],
    sources: [...draft.sourceKeys] as DwaionRoutineDefinition['sources'],
    budget: { ...draft.budget },
    retryPolicy: { ...draft.retryPolicy },
    notificationPolicy: { ...draft.notificationPolicy },
    compensationPolicy: { ...draft.compensationPolicy },
  };
}

function toRoutine(routine: DwaionPersonalRoutine): DwaionRoutine {
  return {
    routineId: routine.routineId,
    title: routine.definition.name,
    description: routine.definition.objective,
    status: routine.lifecycleState,
    revision: routine.revision,
    executionMode: routine.executionMode,
    triggerType: routine.definition.triggerType,
    webhookEventType: routine.definition.webhookEventType ?? null,
    webhookEndpointReference: routine.definition.webhookEndpointReference ?? null,
    sourceKeys: routine.definition.sources,
    schedule: {
      cadence: routine.definition.cadence ?? 'WEEKDAYS',
      localTime: routine.definition.localTime ?? '09:00',
      timeZone: routine.definition.timeZone ?? 'UTC',
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
    backgroundExecutionAvailable: routine.capabilities?.backgroundExecutionAvailable ?? false,
    notificationDeliveryAvailable: routine.capabilities?.notificationDeliveryAvailable ?? false,
    dryRunAvailable: routine.capabilities?.dryRunAvailable ?? false,
    proposalDeliveryAvailable: routine.capabilities?.proposalDeliveryAvailable ?? false,
    activationAvailable: routine.capabilities?.activationAvailable ?? false,
    nextRunAt: routine.nextRunAt ?? null,
    budget: { ...routine.definition.budget },
    retryPolicy: { ...routine.definition.retryPolicy },
    notificationPolicy: { ...routine.definition.notificationPolicy },
    compensationPolicy: { ...routine.definition.compensationPolicy },
  };
}

function toDraft(routine: DwaionRoutine): DwaionRoutineDraft {
  return {
    title: routine.title,
    description: routine.description,
    triggerType: routine.triggerType,
    webhookEventType: routine.webhookEventType ?? '',
    webhookEndpointReference: routine.webhookEndpointReference ?? '',
    sourceKeys: routine.sourceKeys,
    schedule: routine.schedule,
    consentKeys: routine.consents
      .filter((consent) => consent.state === 'ENABLED')
      .map((consent) => consent.key),
    budget: { ...routine.budget },
    retryPolicy: { ...routine.retryPolicy },
    notificationPolicy: { ...routine.notificationPolicy },
    compensationPolicy: { ...routine.compensationPolicy },
  };
}

function routineConsentValue(routine: DwaionPersonalRoutine, key: (typeof CONSENT_KEYS)[number]) {
  if (key === 'SOURCE_ACCESS') return routine.consents.sourceAccess;
  if (key === 'ANALYSIS') return routine.consents.analysis;
  return routine.consents.proposalDelivery;
}

function toDryRunReceipt(receipt: ApiDryRunReceipt): DwaionRoutineDryRunReceipt {
  return {
    routineRunId: receipt.routineRunId,
    routineId: receipt.routineId,
    routineRevision: receipt.routineRevision,
    evaluatedAt: receipt.evaluatedAt,
    outcome: 'VALIDATED',
    evidenceCount: receipt.evidenceCount,
    evidenceScope: 'AUTHORIZED_SOURCE_BINDING',
    businessEvidenceCount: receipt.businessEvidenceCount,
    proposalsCreated: receipt.proposalsCreated,
    externalWritesPerformed: 0,
    validatedSources: receipt.validatedSources,
    previewNextRunAt: receipt.previewNextRunAt ?? null,
    schedulingAvailable: false,
  };
}

function routineCommandReason(action: DwaionRoutineRunCommand['action'], locale: 'ko' | 'en') {
  if (action === 'RETRY')
    return {
      reasonCode: 'USER_CONFIRMED_RETRY',
      changeReason:
        locale === 'ko'
          ? '사용자가 실패 원인과 재시도 예산을 검토하고 실행 재시도를 요청했습니다.'
          : 'The user reviewed the failure and retry budget and requested another attempt.',
    };
  if (action === 'CANCEL')
    return {
      reasonCode: 'USER_CONFIRMED_SAFE_CANCEL',
      changeReason:
        locale === 'ko'
          ? '사용자가 진행 상태를 검토하고 실행을 안전하게 취소했습니다.'
          : 'The user reviewed progress and safely cancelled the execution.',
    };
  return {
    reasonCode: 'USER_CONFIRMED_COMPENSATION',
    changeReason:
      locale === 'ko'
        ? '사용자가 완료 영수증과 영향 범위를 검토하고 보상 처리를 요청했습니다.'
        : 'The user reviewed the receipt and impact and requested compensation.',
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
