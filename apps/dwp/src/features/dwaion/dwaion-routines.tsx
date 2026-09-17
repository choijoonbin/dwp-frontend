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
  createDwaionRoutineAdvancedCommand,
  createDwaionRoutine,
  downloadDwaionRoutineTelemetry,
  dryRunDwaionRoutine,
  getDwaionPersonalAiControls,
  getDwaionRoutine,
  getDwaionRoutineAdvancedCommands,
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
  type DwaionRoutineLifecycleAction,
  type DwaionRoutineExecutionRun,
  type DwaionRoutineAdvancedCommand,
  type DwaionRoutineAdvancedPayload,
  type DwaionRoutineRunCommand,
  type DwaionRoutineRollbackReceipt,
  type DwaionRoutineVersionSnapshot,
} from '@dwp-frontend/shared-utils';

import { DWAION_ROUTINE_COPY_EN, DWAION_ROUTINE_COPY_KO } from './routines/dwaion-routine-copy';
import type {
  DwaionRoutineConflictFailure,
  DwaionRoutineConflictReceipt,
  DwaionRoutineConflictSnapshot,
  DwaionRoutineRecoveryStrategy,
} from './routines/dwaion-routine-conflict-workbench';
import { DwaionRoutineEditorDialog } from './routines/dwaion-routine-editor-dialog';
import {
  RoutineConflictRecoveryError,
  routineRunCommandReason,
  toRoutineDefinition,
  toRoutineDraft,
  toRoutineDryRunReceipt,
  toRoutineView,
} from './routines/dwaion-routine-adapter';
import {
  cloneRoutineDraft,
  createEmptyRoutineDraft,
  mergeRoutineDraft,
} from './routines/dwaion-routine-model';
import { DwaionRoutinesPage } from './routines/dwaion-routines-page';
import { useDwaionRoutineApprovalQueue } from './routines/use-dwaion-routine-approval-queue';

import type { DwaionRoutineSourceOption } from './routines/dwaion-routine-editor-dialog';
import type {
  DwaionRoutine,
  DwaionRoutineDraft,
  DwaionRoutineDryRunReceipt,
  DwaionRoutineMergeSelections,
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
  const governAdvanced = useDwaionGovernedMutation('route.dwaion.work.routine-advanced.action');
  const identity = `${user?.tenantId ?? ''}:${user?.userId ?? ''}`;
  const canView = isAuthenticated && isLoaded && hasPermission('APP.DWAION_ROUTINES', 'VIEW');
  const canManage = canView && hasPermission('APP.DWAION_ROUTINES', 'MANAGE');
  const canApprove = isAuthenticated && isLoaded && hasPermission('APP.DWAION_ROUTINES', 'APPROVE');
  const canReadControls = isAuthenticated && isLoaded && hasPermission('APP.DWAION_MEMORY', 'VIEW');
  const currentTimeZone = resolveSystemTimeZone('UTC');
  const approvalQueue = useDwaionRoutineApprovalQueue({
    enabled: canApprove,
    identity,
    approvedMessage: copy.approvalQueue.approved,
    rejectedMessage: copy.approvalQueue.rejected,
    failedMessage: copy.commandFailed,
  });

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

  const routines = useMemo(
    () => (routinesQuery.data ?? []).map(toRoutineView),
    [routinesQuery.data]
  );
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
  const advancedCommandsQuery = useQuery({
    queryKey: ['dwaion', 'routine-advanced-commands', identity, effectiveSelectedId],
    queryFn: ({ signal }) => getDwaionRoutineAdvancedCommands(effectiveSelectedId!, signal),
    enabled: canView && Boolean(effectiveSelectedId),
    staleTime: 15_000,
    retry: retryGovernedQuery,
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
  const [advancedCommand, setAdvancedCommand] = useState<DwaionRoutineAdvancedCommand | null>(null);
  const visibleAdvancedCommand =
    advancedCommand?.routineId === effectiveSelectedId
      ? advancedCommand
      : (advancedCommandsQuery.data?.[0] ?? null);
  const [commandError, setCommandError] = useState<
    'REVISION_CONFLICT' | 'COMMAND_FAILED' | 'RECOVERY_REJECTED' | undefined
  >();
  const [conflictSnapshot, setConflictSnapshot] = useState<DwaionRoutineConflictSnapshot | null>(
    null
  );
  const [conflictReceipt, setConflictReceipt] = useState<DwaionRoutineConflictReceipt | null>(null);
  const [conflictFailure, setConflictFailure] = useState<DwaionRoutineConflictFailure | null>(null);
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
              toRoutineDefinition(input.draft, locale),
              authority
            )
          )
        : await governCreate((authority) =>
            createDwaionRoutine(toRoutineDefinition(input.draft, locale), authority)
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
    onError: (error, input) => {
      const baseRoutine = input.routineId
        ? routines.find((routine) => routine.routineId === input.routineId)
        : undefined;
      handleCommandError(error, baseRoutine, input.draft);
    },
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
    onError: (error, input) =>
      handleCommandError(
        error,
        routines.find((routine) => routine.routineId === input.routineId)
      ),
  });
  const dryRunMutation = useMutation({
    mutationFn: (input: { routineId: string; expectedRevision: number }) =>
      governDryRun((authority) =>
        dryRunDwaionRoutine(input.routineId, input.expectedRevision, authority)
      ),
    onSuccess: (receipt) => {
      setDryRunReceipt(toRoutineDryRunReceipt(receipt));
      setCommandError(undefined);
      toast.success(copy.validationComplete);
    },
    onError: (error, input) =>
      handleCommandError(
        error,
        routines.find((routine) => routine.routineId === input.routineId)
      ),
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
    onError: (error, input) =>
      handleCommandError(
        error,
        routines.find((routine) => routine.routineId === input.routineId)
      ),
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
    onError: (error, input) => handleCommandError(error, input.routine),
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
    onError: (error, routine) => handleCommandError(error, routine),
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
      const reason = routineRunCommandReason(input.action, locale);
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
    onError: (error, input) => {
      if (
        input.action === 'SKIP_QUARANTINED_AND_CONTINUE' &&
        error instanceof HttpError &&
        error.status === 409
      ) {
        setCommandError('RECOVERY_REJECTED');
        void Promise.all([runsQuery.refetch(), capabilitiesQuery.refetch()]);
        toast.error(copy.skipQuarantinedRejected);
        return;
      }
      handleCommandError(error, input.routine);
    },
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
    onError: (error, input) => handleCommandError(error, input.routine),
  });
  const conflictRecoveryMutation = useMutation({
    mutationFn: async (input: {
      strategy: DwaionRoutineRecoveryStrategy;
      selections: DwaionRoutineMergeSelections;
    }) => {
      const snapshot = conflictSnapshot;
      if (!snapshot?.serverRoutine || !snapshot.serverDraft) {
        throw new RoutineConflictRecoveryError(copy.conflictFetchFailed, null);
      }

      let current: DwaionPersonalRoutine | null = null;
      let targetRoutineId = snapshot.routineId;
      try {
        if (input.strategy === 'FORK') {
          current = await governCreate((authority) =>
            createDwaionRoutine(toRoutineDefinition(snapshot.localDraft, locale), authority)
          );
          targetRoutineId = current.routineId;
          current = await applyDraftConsents(current, snapshot.localDraft);
        } else if (input.strategy === 'SERVER') {
          current = await getDwaionRoutine(snapshot.routineId);
        } else {
          const latest = await getDwaionRoutine(snapshot.routineId);
          if (latest.revision !== snapshot.serverRoutine.revision) {
            throw new RoutineConflictRecoveryError(copy.revisionConflict, toRoutineView(latest));
          }
          const mergedDraft = mergeRoutineDraft(
            snapshot.localDraft,
            snapshot.serverDraft,
            input.selections
          );
          current = await governUpdate((authority) =>
            updateDwaionRoutine(
              latest.routineId,
              latest.revision,
              toRoutineDefinition(mergedDraft, locale),
              authority
            )
          );
          current = await applyDraftConsents(current, mergedDraft);
        }

        const versions = await getDwaionRoutineVersions(current.routineId);
        const ledgerEntry = versions.find((version) => version.revision === current!.revision);
        if (!ledgerEntry) {
          throw new RoutineConflictRecoveryError(
            copy.conflictRecoveryFailed,
            toRoutineView(current)
          );
        }
        return {
          strategy: input.strategy,
          current,
          receipt: {
            strategy: input.strategy,
            routineId: current.routineId,
            revision: ledgerEntry.revision,
            commandId: ledgerEntry.commandId,
            integrityFingerprint: ledgerEntry.integrityFingerprint,
            createdAt: ledgerEntry.createdAt,
          } satisfies DwaionRoutineConflictReceipt,
        };
      } catch (error) {
        if (error instanceof RoutineConflictRecoveryError) throw error;
        let serverRoutine: DwaionRoutine | null = current ? toRoutineView(current) : null;
        try {
          serverRoutine = toRoutineView(await getDwaionRoutine(targetRoutineId));
        } catch {
          // The last verified mutation response remains the best available partial state.
        }
        throw new RoutineConflictRecoveryError(
          error instanceof HttpError && error.status === 409
            ? copy.revisionConflict
            : copy.commandFailed,
          serverRoutine
        );
      }
    },
    onSuccess: async ({ strategy, current, receipt }) => {
      replaceRoutineCache(current);
      setConflictSnapshot(null);
      setConflictFailure(null);
      setConflictReceipt(receipt);
      setCommandError(undefined);
      setSelectedId(current.routineId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ROUTINES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'routine-versions'] }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'routine-health'] }),
      ]);
      toast.success(
        strategy === 'FORK'
          ? copy.conflictForkComplete
          : strategy === 'SERVER'
            ? copy.conflictServerComplete
            : copy.conflictMergeComplete
      );
    },
    onError: (error) => {
      const recoveryError =
        error instanceof RoutineConflictRecoveryError
          ? error
          : new RoutineConflictRecoveryError(copy.commandFailed, null);
      setConflictFailure({
        message: recoveryError.message,
        serverRoutine: recoveryError.serverRoutine,
      });
      if (recoveryError.serverRoutine) {
        setConflictSnapshot((current) =>
          current && current.routineId === recoveryError.serverRoutine?.routineId
            ? {
                ...current,
                serverRoutine: recoveryError.serverRoutine,
                serverDraft: toRoutineDraft(recoveryError.serverRoutine),
                loading: false,
                loadError: false,
              }
            : current
        );
      }
      toast.error(copy.conflictRecoveryFailed);
    },
  });
  const telemetryMutation = useMutation({
    mutationFn: (routine: DwaionRoutine) => downloadDwaionRoutineTelemetry(routine.routineId),
    onSuccess: (blob, routine) => {
      downloadBlob(blob, `routine-${routine.routineId}-telemetry.jsonl`);
      toast.success(copy.telemetryDownloaded);
    },
    onError: () => toast.error(copy.telemetryFailed),
  });
  const advancedMutation = useMutation({
    mutationFn: (input: { routine: DwaionRoutine; payload: DwaionRoutineAdvancedPayload }) => {
      const key = `advanced:${input.routine.routineId}:${input.routine.revision}:${JSON.stringify(input.payload)}`;
      const commandId = commandIds.current.get(key) ?? newDwaionRoutineCommandId();
      commandIds.current.set(key, commandId);
      return governAdvanced((authority) =>
        createDwaionRoutineAdvancedCommand(
          input.routine.routineId,
          input.routine.revision,
          commandId,
          input.payload,
          authority
        )
      );
    },
    onSuccess: async (command, input) => {
      commandIds.current.delete(
        `advanced:${input.routine.routineId}:${input.routine.revision}:${JSON.stringify(input.payload)}`
      );
      setAdvancedCommand(command);
      setCommandError(command.state === 'FAILED' ? 'COMMAND_FAILED' : undefined);
      if (input.payload.kind === 'CHANGE_APPROVAL') setEditorOpen(false);
      if (command.state === 'FAILED' || command.state === 'PARTIAL') {
        toast.error(command.problem?.detail ?? copy.commandFailed);
      } else {
        toast.success(copy.runCommandSaved);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ROUTINES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'routine-advanced-commands'] }),
      ]);
    },
    onError: (error, input) => handleCommandError(error, input.routine),
  });

  async function applyDraftConsents(
    startingRoutine: DwaionPersonalRoutine,
    targetDraft: DwaionRoutineDraft
  ): Promise<DwaionPersonalRoutine> {
    let current = startingRoutine;
    for (const key of CONSENT_KEYS) {
      const desired = targetDraft.consentKeys.includes(key) ? 'ENABLED' : 'DISABLED';
      if (routineConsentValue(current, key) === desired) continue;
      current = await governConsent((authority) =>
        changeDwaionRoutineConsent(current.routineId, current.revision, key, desired, authority)
      );
    }
    return current;
  }

  function replaceRoutineCache(routine: DwaionPersonalRoutine) {
    queryClient.setQueryData<DwaionPersonalRoutine[]>([...ROUTINES_KEY, identity], (current) => {
      const existing = current ?? [];
      return existing.some((item) => item.routineId === routine.routineId)
        ? existing.map((item) => (item.routineId === routine.routineId ? routine : item))
        : [routine, ...existing];
    });
  }

  async function loadConflictServer(baseRoutine: DwaionRoutine, localDraft: DwaionRoutineDraft) {
    const preservedBase = cloneRoutineDraft(toRoutineDraft(baseRoutine));
    const preservedLocal = cloneRoutineDraft(localDraft);
    setConflictReceipt(null);
    setConflictFailure(null);
    setConflictSnapshot({
      routineId: baseRoutine.routineId,
      baseRevision: baseRoutine.revision,
      baseDraft: preservedBase,
      localDraft: preservedLocal,
      serverRoutine: null,
      serverDraft: null,
      loading: true,
      loadError: false,
    });
    try {
      const latestApiRoutine = await getDwaionRoutine(baseRoutine.routineId);
      const latestRoutine = toRoutineView(latestApiRoutine);
      replaceRoutineCache(latestApiRoutine);
      setConflictSnapshot({
        routineId: baseRoutine.routineId,
        baseRevision: baseRoutine.revision,
        baseDraft: preservedBase,
        localDraft: preservedLocal,
        serverRoutine: latestRoutine,
        serverDraft: cloneRoutineDraft(toRoutineDraft(latestRoutine)),
        loading: false,
        loadError: false,
      });
    } catch {
      setConflictSnapshot((current) =>
        current?.routineId === baseRoutine.routineId
          ? { ...current, loading: false, loadError: true }
          : current
      );
    }
  }

  function reloadConflictServer() {
    const current = conflictSnapshot;
    if (!current) return;
    setConflictFailure(null);
    setConflictSnapshot({ ...current, loading: true, loadError: false });
    void getDwaionRoutine(current.routineId)
      .then((latestApiRoutine) => {
        const latestRoutine = toRoutineView(latestApiRoutine);
        replaceRoutineCache(latestApiRoutine);
        setConflictSnapshot((snapshot) =>
          snapshot?.routineId === current.routineId
            ? {
                ...snapshot,
                serverRoutine: latestRoutine,
                serverDraft: cloneRoutineDraft(toRoutineDraft(latestRoutine)),
                loading: false,
                loadError: false,
              }
            : snapshot
        );
      })
      .catch(() => {
        setConflictSnapshot((snapshot) =>
          snapshot?.routineId === current.routineId
            ? { ...snapshot, loading: false, loadError: true }
            : snapshot
        );
      });
  }

  function handleCommandError(
    error: Error,
    baseRoutine?: DwaionRoutine,
    localDraft?: DwaionRoutineDraft
  ) {
    const conflict = error instanceof HttpError && error.status === 409;
    if (conflict) {
      setEditorOpen(false);
      setEditingId(null);
      const target = baseRoutine ?? routines.find((routine) => routine.routineId === selectedId);
      if (target) void loadConflictServer(target, localDraft ?? toRoutineDraft(target));
    }
    setCommandError(conflict ? 'REVISION_CONFLICT' : 'COMMAND_FAILED');
    if (!conflict) void queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
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
    conflictRecoveryMutation.isPending ||
    telemetryMutation.isPending ||
    advancedMutation.isPending ||
    approvalQueue.pending;
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
    setDraft(toRoutineDraft(routine));
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
        conflictSnapshot={conflictSnapshot}
        conflictReceipt={conflictReceipt}
        conflictFailure={conflictFailure}
        conflictBusy={conflictRecoveryMutation.isPending}
        dryRunReceipt={dryRunReceipt}
        runtimeCapabilities={capabilitiesQuery.data}
        runtimeCapabilitiesError={capabilitiesQuery.isError}
        runs={runsQuery.data ?? []}
        runsLoading={runsQuery.isPending && Boolean(effectiveSelectedId)}
        runsError={runsQuery.isError}
        versions={versionsQuery.data ?? []}
        health={healthQuery.data}
        rollbackReceipt={rollbackReceipt}
        advancedCommand={visibleAdvancedCommand}
        approvalQueue={approvalQueue.commands}
        approvalQueueLoading={approvalQueue.loading}
        approvalQueueError={approvalQueue.error}
        evidenceLoading={
          Boolean(effectiveSelectedId) && (versionsQuery.isPending || healthQuery.isPending)
        }
        evidenceError={versionsQuery.isError || healthQuery.isError}
        busy={busy}
        canManage={canManage}
        canApprove={canApprove}
        canCreate={canConfigure}
        onRetry={() =>
          void Promise.all([
            routinesQuery.refetch(),
            controlsQuery.refetch(),
            capabilitiesQuery.refetch(),
            runsQuery.refetch(),
            advancedCommandsQuery.refetch(),
            versionsQuery.refetch(),
            healthQuery.refetch(),
            canApprove ? approvalQueue.retry() : Promise.resolve(),
          ])
        }
        onResolveConflict={(strategy, selections) =>
          conflictRecoveryMutation.mutate({ strategy, selections })
        }
        onReloadConflict={reloadConflictServer}
        onDismissConflict={() => {
          setConflictSnapshot(null);
          setConflictFailure(null);
          setCommandError(undefined);
        }}
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
        onAdvancedCommand={(routine, payload) => advancedMutation.mutate({ routine, payload })}
        onRetryApprovals={() => void approvalQueue.retry()}
        onDecideApproval={approvalQueue.decide}
        onRetryRuntime={() =>
          void Promise.all([
            capabilitiesQuery.refetch(),
            runsQuery.refetch(),
            advancedCommandsQuery.refetch(),
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
        savedDraft={editingRoutine ? toRoutineDraft(editingRoutine) : null}
        sourceOptions={sourceOptions}
        timeZoneOptions={[...new Set([currentTimeZone, 'UTC'])]}
        capabilities={capabilitiesQuery.data}
        busy={saveMutation.isPending}
        dryRunBusy={dryRunMutation.isPending}
        advancedBusy={advancedMutation.isPending}
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
        onRequestChangeApproval={
          editingRoutine
            ? (nextDraft) =>
                advancedMutation.mutate({
                  routine: editingRoutine,
                  payload: {
                    kind: 'CHANGE_APPROVAL',
                    definition: toRoutineDefinition(nextDraft, locale),
                  },
                })
            : undefined
        }
        onRequestEngineSwitch={
          editingRoutine
            ? () =>
                advancedMutation.mutate({
                  routine: editingRoutine,
                  payload: {
                    kind: 'AGENT_ENGINE_SWITCH',
                    action: 'APPLY',
                    agentId: 'dwaion-personal-routine-agent',
                    engineId: 'dwp-agent-kernel-v1',
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  },
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

function routineConsentValue(routine: DwaionPersonalRoutine, key: (typeof CONSENT_KEYS)[number]) {
  if (key === 'SOURCE_ACCESS') return routine.consents.sourceAccess;
  if (key === 'ANALYSIS') return routine.consents.analysis;
  return routine.consents.proposalDelivery;
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
