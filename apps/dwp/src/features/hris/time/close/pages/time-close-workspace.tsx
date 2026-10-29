import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';

import { createTimeCloseDataSource } from '../api/time-close-api';
import { TimeCloseCommandCenter } from '../components/time-close-command-center';
import { TimeCloseCommandDialogs } from '../components/time-close-command-dialogs';
import { useTimeCloseCommands } from '../hooks/use-time-close-commands';
import { useTimeCloseWorkspace } from '../hooks/use-time-close-workspace';

import type { TimeCloseDataSource } from '../api/time-close-api';
import type { TimeCloseCommandOwnerBinding } from '../hooks/use-time-close-commands';
import type {
  PayrollTimeHandoffStatus,
  TimeCloseEntryMode,
  TimeClosePageRouteContractKey,
  TimeClosePeriod,
  TimeCloseScope,
} from '../model/time-close-model';

export type TimeClosePageOwnerBinding = Readonly<{
  routeContractKey: TimeClosePageRouteContractKey;
}>;

export type TimeCloseOwnerBinding = Readonly<{
  page?: TimeClosePageOwnerBinding;
  commands?: TimeCloseCommandOwnerBinding;
  handoffStatus?: Readonly<{
    routeContractKey: 'route.hcm.operations.time-payroll-handoff.data';
  }>;
}>;

export type TimeCloseWorkspaceRuntimeProps = Readonly<{
  enabled?: boolean;
  tenantEnrolled?: boolean;
  entryMode: TimeCloseEntryMode;
  scope: TimeCloseScope;
  ownerBinding?: TimeCloseOwnerBinding;
  dataSource?: TimeCloseDataSource;
  focusResourceId?: string | null;
  onFocusResourceChange?: (resourceId: string | null) => void;
  idFactory?: () => string;
}>;

const productionDataSource = createTimeCloseDataSource();

const pageRoute: Record<TimeCloseEntryMode, TimeClosePageRouteContractKey> = {
  COMMAND_CENTER: 'route.hcm.operations.time-command-center.page',
  DAILY_CLOSE: 'route.hcm.operations.time-daily-close.page',
  MONTHLY_CLOSE: 'route.hcm.operations.time-monthly-close.page',
};

function TimeCloseWorkspace({
  entryMode,
  scope,
  ownerBinding,
  dataSource = productionDataSource,
  focusResourceId,
  onFocusResourceChange,
  idFactory,
}: Omit<TimeCloseWorkspaceRuntimeProps, 'enabled' | 'tenantEnrolled'>) {
  const { t } = useTranslation('hcm');
  const controlledFocus = focusResourceId !== undefined;
  const pageBound = ownerBinding?.page?.routeContractKey === pageRoute[entryMode];
  const reader = pageBound ? dataSource.readProjection : undefined;
  const runtime = useTimeCloseWorkspace({ reader, entryMode, scope });
  const authorityCurrent =
    runtime.scopeCurrent &&
    !runtime.refreshing &&
    runtime.state.freshness === 'CURRENT' &&
    runtime.state.refreshFailure === undefined &&
    (runtime.state.kind === 'READY' || runtime.state.kind === 'PARTIAL');
  const emptyUi = useMemo(
    () => ({
      identity: runtime.protectedStateIdentity,
      localFocus: null,
      filter: '',
      handoffId: '',
    }),
    [runtime.protectedStateIdentity]
  );
  const [uiRecord, setUiRecord] = useState<
    Readonly<{
      identity: string;
      localFocus: string | null;
      filter: string;
      handoffId: string;
    }>
  >(emptyUi);
  const ui = uiRecord.identity === runtime.protectedStateIdentity ? uiRecord : emptyUi;
  const [controlledFocusRecord, setControlledFocusRecord] = useState<
    Readonly<{ identity: string; input: string | null | undefined; value: string | null }>
  >({
    identity: runtime.protectedStateIdentity,
    input: focusResourceId,
    value: focusResourceId ?? null,
  });
  const controlledSelectedId =
    controlledFocusRecord.identity === runtime.protectedStateIdentity
      ? controlledFocusRecord.value
      : null;
  const selectedId = controlledFocus ? controlledSelectedId : ui.localFocus;
  const selected =
    runtime.state.periods.find(
      (period) => period.periodId === selectedId || period.deepLinkResourceId === selectedId
    ) ?? null;
  const [handoffRecord, setHandoffRecord] = useState<
    Readonly<{ identity: string; value: PayrollTimeHandoffStatus | null; error: boolean }>
  >({ identity: '', value: null, error: false });
  const [handoffBusyRecord, setHandoffBusyRecord] = useState<
    Readonly<{ identity: string; busy: boolean }>
  >({ identity: runtime.protectedStateIdentity, busy: false });
  const handoffAbortRef = useRef<AbortController | null>(null);
  const handoffBusyRef = useRef(false);
  const visibleScopeIdentityRef = useRef(runtime.protectedStateIdentity);
  visibleScopeIdentityRef.current = runtime.protectedStateIdentity;
  const previousScopeIdentityRef = useRef(runtime.protectedStateIdentity);
  const handoffBusy =
    handoffBusyRecord.identity === runtime.protectedStateIdentity && handoffBusyRecord.busy;

  const clearProtectedState = useCallback(() => {
    handoffAbortRef.current?.abort();
    handoffAbortRef.current = null;
    handoffBusyRef.current = false;
    setHandoffBusyRecord({ identity: runtime.protectedStateIdentity, busy: false });
    setUiRecord(emptyUi);
    setControlledFocusRecord({
      identity: runtime.protectedStateIdentity,
      input: focusResourceId,
      value: null,
    });
    setHandoffRecord({ identity: '', value: null, error: false });
    onFocusResourceChange?.(null);
  }, [emptyUi, focusResourceId, onFocusResourceChange, runtime.protectedStateIdentity]);

  const denyWorkspace = runtime.deny;
  const denyProtectedState = useCallback(() => {
    clearProtectedState();
    denyWorkspace();
  }, [clearProtectedState, denyWorkspace]);

  const commands = useTimeCloseCommands({
    dataSource,
    owner: ownerBinding?.commands,
    scope,
    period: selected,
    scopeIdentity: runtime.protectedStateIdentity,
    readSuccessRevision: runtime.readSuccessRevision,
    commandAuthorityCurrent: authorityCurrent,
    reload: runtime.refresh,
    onDenied: denyProtectedState,
    ...(idFactory ? { idFactory } : {}),
  });
  const handoffIdentity = `${runtime.protectedStateIdentity}:${selected?.periodId ?? 'none'}:${ui.handoffId}`;
  const handoff =
    handoffRecord.identity === handoffIdentity &&
    handoffRecord.value?.closePeriodId === selected?.periodId
      ? handoffRecord.value
      : null;
  const handoffError = handoffRecord.identity === handoffIdentity && handoffRecord.error;
  const acceptSuccessfulRefresh = commands.acceptSuccessfulRefresh;

  useEffect(() => {
    acceptSuccessfulRefresh(runtime.readSuccessRevision);
  }, [acceptSuccessfulRefresh, runtime.readSuccessRevision]);

  useEffect(() => {
    if (previousScopeIdentityRef.current === runtime.protectedStateIdentity) return;
    previousScopeIdentityRef.current = runtime.protectedStateIdentity;
    clearProtectedState();
  }, [clearProtectedState, runtime.protectedStateIdentity]);

  useEffect(() => {
    if (!controlledFocus || controlledFocusRecord.identity !== runtime.protectedStateIdentity)
      return;
    if (controlledFocusRecord.input === focusResourceId) return;
    setControlledFocusRecord({
      identity: runtime.protectedStateIdentity,
      input: focusResourceId,
      value: focusResourceId ?? null,
    });
  }, [controlledFocus, controlledFocusRecord, focusResourceId, runtime.protectedStateIdentity]);

  useEffect(() => {
    if (runtime.state.kind === 'LOADING' || runtime.state.kind === 'ERROR' || !selectedId) return;
    const found = runtime.state.periods.some(
      (period) => period.periodId === selectedId || period.deepLinkResourceId === selectedId
    );
    if (!found && runtime.state.nextCursor === null) {
      if (!controlledFocus) setUiRecord({ ...ui, localFocus: null });
      onFocusResourceChange?.(null);
    }
  }, [
    controlledFocus,
    onFocusResourceChange,
    runtime.state.kind,
    runtime.state.nextCursor,
    runtime.state.periods,
    selectedId,
    ui,
  ]);

  useEffect(
    () => () => {
      handoffAbortRef.current?.abort();
    },
    []
  );

  const selectPeriod = useCallback(
    (period: TimeClosePeriod) => {
      if (!controlledFocus) setUiRecord({ ...ui, localFocus: period.deepLinkResourceId });
      onFocusResourceChange?.(period.deepLinkResourceId);
    },
    [controlledFocus, onFocusResourceChange, ui]
  );

  const readHandoff = useCallback(async () => {
    if (
      ownerBinding?.handoffStatus?.routeContractKey !==
        'route.hcm.operations.time-payroll-handoff.data' ||
      !authorityCurrent ||
      !selected ||
      handoffBusyRef.current
    ) {
      return;
    }
    const identity = handoffIdentity;
    const scopeIdentity = runtime.protectedStateIdentity;
    const periodId = selected.periodId;
    const abort = new AbortController();
    handoffAbortRef.current?.abort();
    handoffAbortRef.current = abort;
    handoffBusyRef.current = true;
    setHandoffBusyRecord({ identity: scopeIdentity, busy: true });
    try {
      const value = await dataSource.readHandoff(ui.handoffId, scope, abort.signal);
      if (
        abort.signal.aborted ||
        visibleScopeIdentityRef.current !== scopeIdentity ||
        value.closePeriodId !== periodId
      ) {
        if (value.closePeriodId !== periodId) {
          throw new Error('Payroll handoff does not belong to the selected close period.');
        }
        return;
      }
      setHandoffRecord({ identity, value, error: false });
    } catch (error: unknown) {
      if (abort.signal.aborted || visibleScopeIdentityRef.current !== scopeIdentity) return;
      if (
        error instanceof HttpError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        denyProtectedState();
      } else {
        setHandoffRecord({ identity, value: null, error: true });
      }
    } finally {
      if (handoffAbortRef.current === abort) handoffAbortRef.current = null;
      if (visibleScopeIdentityRef.current === scopeIdentity) {
        handoffBusyRef.current = false;
        setHandoffBusyRecord({ identity: scopeIdentity, busy: false });
      }
    }
  }, [
    authorityCurrent,
    dataSource,
    denyProtectedState,
    handoffIdentity,
    ownerBinding?.handoffStatus,
    runtime.protectedStateIdentity,
    scope,
    selected,
    ui.handoffId,
  ]);

  const commandNotice = useMemo(() => {
    if (commands.feedback?.kind === 'CONFLICT') {
      return (
        <InlineFeedback
          severity="warning"
          title={t('hrisTime.i18nClosure.close.notice.conflictTitle')}
        >
          {t('hrisTime.i18nClosure.close.notice.conflictDescription')}
        </InlineFeedback>
      );
    }
    if (commands.feedback?.kind === 'DENIED') {
      return (
        <InlineFeedback severity="error" title={t('hrisTime.i18nClosure.close.notice.deniedTitle')}>
          {t('hrisTime.i18nClosure.close.notice.deniedDescription')}
        </InlineFeedback>
      );
    }
    if (commands.feedback?.kind === 'REJECTED') {
      return (
        <InlineFeedback
          severity="error"
          title={t('hrisTime.i18nClosure.close.notice.rejectedTitle')}
        >
          {t('hrisTime.i18nClosure.close.notice.rejectedDescription')}
        </InlineFeedback>
      );
    }
    if (commands.feedback?.kind === 'RESULT_UNKNOWN') {
      return (
        <InlineFeedback
          severity="warning"
          title={t('hrisTime.i18nClosure.close.notice.unknownTitle')}
        >
          {t('hrisTime.i18nClosure.close.notice.unknownDescription')}
        </InlineFeedback>
      );
    }
    return null;
  }, [commands.feedback, t]);

  return (
    <Stack gap={2}>
      {commands.feedback?.kind === 'RECEIPT' && (
        <InlineFeedback
          severity={
            commands.feedback.receipt.status === 'SUCCEEDED'
              ? 'success'
              : commands.feedback.receipt.status === 'REJECTED' ||
                  commands.feedback.receipt.status === 'FAILED'
                ? 'error'
                : 'info'
          }
          title={t('hrisTime.i18nClosure.close.notice.ownerReceipt', {
            status: commands.feedback.receipt.status,
          })}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
            <span>
              {commands.feedback.receipt.receiptId}
              {commands.feedback.receipt.resultRef
                ? t('hrisTime.i18nClosure.close.notice.immutableResultSuffix', {
                    value: commands.feedback.receipt.resultRef,
                  })
                : ''}
            </span>
            {['ACCEPTED', 'RUNNING'].includes(commands.feedback.receipt.status) && (
              <ActionButton
                intent="secondary"
                size="small"
                onClick={() => void commands.reconcile()}
              >
                {t('hrisTime.i18nClosure.close.notice.checkReceipt')}
              </ActionButton>
            )}
          </Stack>
        </InlineFeedback>
      )}
      {commands.feedback?.kind === 'RESULT_UNKNOWN' && (
        <InlineFeedback
          severity="warning"
          title={t('hrisTime.i18nClosure.close.notice.outcomeUnprovenTitle')}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
            <span>{t('hrisTime.i18nClosure.close.notice.outcomeUnprovenDescription')}</span>
            <ActionButton
              intent="secondary"
              size="small"
              disabled={commands.commandDisabled}
              onClick={() => void commands.retryExact()}
            >
              {t('hrisTime.i18nClosure.close.notice.replayExact')}
            </ActionButton>
            {commands.feedback.canReconcile && (
              <ActionButton
                intent="secondary"
                size="small"
                disabled={commands.busy}
                onClick={() => void commands.reconcile()}
              >
                {t('hrisTime.i18nClosure.close.notice.reconcileReceipt')}
              </ActionButton>
            )}
          </Stack>
        </InlineFeedback>
      )}
      {commands.feedback?.kind === 'CONFLICT' && (
        <InlineFeedback
          severity="warning"
          title={t('hrisTime.i18nClosure.close.notice.refreshRequiredTitle')}
        >
          {t('hrisTime.i18nClosure.close.notice.refreshRequiredDescription')}
        </InlineFeedback>
      )}
      {handoffError && (
        <InlineFeedback
          severity="error"
          title={t('hrisTime.i18nClosure.close.notice.handoffErrorTitle')}
        >
          {t('hrisTime.i18nClosure.close.notice.handoffErrorDescription')}
        </InlineFeedback>
      )}
      <TimeCloseCommandCenter
        entryMode={entryMode}
        workspace={runtime.state}
        selectedPeriodId={selected?.periodId ?? null}
        filter={ui.filter}
        busy={commands.busy || runtime.refreshing}
        commandDisabled={commands.commandDisabled || !runtime.scopeCurrent}
        handoffId={ui.handoffId}
        handoff={handoff}
        handoffBusy={handoffBusy}
        canReadHandoff={
          authorityCurrent &&
          selected !== null &&
          ownerBinding?.handoffStatus?.routeContractKey ===
            'route.hcm.operations.time-payroll-handoff.data'
        }
        onFilterChange={(value) => setUiRecord({ ...ui, filter: value })}
        onSelect={selectPeriod}
        onRefresh={runtime.refresh}
        onLoadMore={() => void runtime.loadMore()}
        onOpenCommand={commands.open}
        onHandoffIdChange={(value) => {
          setUiRecord({ ...ui, handoffId: value });
          setHandoffRecord({ identity: '', value: null, error: false });
        }}
        onReadHandoff={() => void readHandoff()}
      />
      {selected && (
        <TimeCloseCommandDialogs
          key={`${runtime.protectedStateIdentity}:${selected.periodId}`}
          mode={commands.mode}
          period={selected}
          busy={commands.busy}
          commandDisabled={commands.commandDisabled}
          notice={commandNotice}
          onClose={commands.closeDialog}
          onValidate={(request) => void commands.submit('VALIDATE', request)}
          onClosePeriod={(request) => void commands.submit('CLOSE', request)}
          onReopen={(request) => void commands.submit('REOPEN', request)}
          onCreateHandoff={(request) => void commands.submit('HANDOFF', request)}
        />
      )}
    </Stack>
  );
}

/**
 * Route-neutral default-OFF boundary. A disabled or unenrolled tenant returns before any close
 * hook, HTTP adapter, challenge coordinator, or owner binding can mount.
 */
export function TimeCloseWorkspaceRuntime({
  enabled = false,
  tenantEnrolled = false,
  ...props
}: TimeCloseWorkspaceRuntimeProps) {
  if (!enabled || !tenantEnrolled) return null;
  return <TimeCloseWorkspace {...props} />;
}
