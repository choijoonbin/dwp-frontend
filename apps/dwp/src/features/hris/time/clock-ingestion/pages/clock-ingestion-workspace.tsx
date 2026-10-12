import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

import { ProductSurfaceHighRiskCommandDialog } from '../../../../../components/product-surface-high-risk-command';
import { createClockIngestionDataSource } from '../api/clock-ingestion-api';
import { ClockIngestionCommandCenter } from '../components/clock-ingestion-command-center';
import { ClockRecordDialog, ClockVoidDialog } from '../components/clock-ingestion-command-dialogs';
import { useClockIngestionCommands } from '../hooks/use-clock-ingestion-commands';
import { useClockIngestionWorkspace } from '../hooks/use-clock-ingestion-workspace';

import type { ProductSurfaceHighRiskCommandController } from '../../../../../components/product-surface-high-risk-command';
import type { ClockIngestionDataSource } from '../api/clock-ingestion-api';
import type { ClockPageEntryMode } from '../components/clock-ingestion-command-center';
import type {
  ClockCommandOwnerBinding,
  ClockVoidCommandOwnerBinding,
} from '../hooks/use-clock-ingestion-commands';
import type {
  ClockEventPageReader,
  ClockExceptionPageReader,
} from '../hooks/use-clock-ingestion-workspace';
import type {
  ClockEvent,
  ClockException,
  ClockIngestionScope,
  RecordClockEventRequest,
} from '../model/clock-ingestion-model';
import type { ClockIngestionCopy } from '../model/clock-ingestion-copy';

export type ClockEventPageOwnerBinding = Readonly<{
  routeContractKey: 'route.hcm.operations.time-clock-ingestion.page';
  read: ClockEventPageReader;
}>;

export type ClockExceptionPageOwnerBinding = Readonly<{
  routeContractKey: 'route.hcm.operations.time-exceptions.page';
  read: ClockExceptionPageReader;
}>;

export type ClockIngestionOwnerBinding = Readonly<{
  eventPage?: ClockEventPageOwnerBinding;
  exceptionPage?: ClockExceptionPageOwnerBinding;
  commands?: Omit<ClockCommandOwnerBinding, 'voidEvent'> &
    Readonly<{
      voidEvent?: ClockVoidCommandOwnerBinding &
        Readonly<{ controller: ProductSurfaceHighRiskCommandController }>;
      recordDefaults?: Partial<RecordClockEventRequest>;
    }>;
}>;

export type ClockIngestionWorkspaceProps = Readonly<{
  scope: ClockIngestionScope;
  copy: ClockIngestionCopy;
  entryMode: ClockPageEntryMode;
  ownerBinding?: ClockIngestionOwnerBinding;
  dataSource?: ClockIngestionDataSource;
  focusResourceId?: string | null;
  onFocusResourceChange?: (resourceId: string | null) => void;
}>;

const productionDataSource = createClockIngestionDataSource();

function eventForFocus(
  entryMode: ClockPageEntryMode,
  focusResourceId: string | null,
  events: readonly ClockEvent[],
  exceptions: readonly ClockException[]
): ClockEvent | null {
  if (entryMode === 'CLOCK_INGESTION') {
    return events.find((event) => event.deepLinkResourceId === focusResourceId) ?? null;
  }
  const exception = exceptions.find(
    (candidate) => candidate.deepLinkResourceId === focusResourceId
  );
  return events.find((event) => event.clockEventId === exception?.clockEventId) ?? null;
}

/**
 * Route-neutral runtime. Control supplies independent exact PAGE readers and governed ACTION
 * executors. Missing bindings stay closed and cannot fall through to an adjacent route grant.
 */
export function ClockIngestionWorkspace({
  scope,
  copy,
  entryMode,
  ownerBinding,
  dataSource = productionDataSource,
  focusResourceId,
  onFocusResourceChange,
}: ClockIngestionWorkspaceProps) {
  const controlledFocus = focusResourceId !== undefined;
  const [localFocus, setLocalFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'NEEDS_REVIEW'>(
    entryMode === 'TIME_EXCEPTIONS' ? 'NEEDS_REVIEW' : 'ALL'
  );
  const invalidFocusRef = useRef<string | null>(null);
  const readers = useMemo(
    () => ({
      ...(ownerBinding?.eventPage?.routeContractKey ===
      'route.hcm.operations.time-clock-ingestion.page'
        ? { events: ownerBinding.eventPage.read }
        : {}),
      ...(ownerBinding?.exceptionPage?.routeContractKey ===
      'route.hcm.operations.time-exceptions.page'
        ? { exceptions: ownerBinding.exceptionPage.read }
        : {}),
    }),
    [ownerBinding?.eventPage, ownerBinding?.exceptionPage]
  );
  const runtime = useClockIngestionWorkspace(readers, scope);
  const commands = useClockIngestionCommands({
    dataSource,
    owner: ownerBinding?.commands,
    scope,
    reload: runtime.reload,
  });
  const focus = controlledFocus ? (focusResourceId ?? null) : localFocus;
  const defaultException =
    entryMode === 'TIME_EXCEPTIONS' && focus === null
      ? (runtime.workspace.exceptions.find((entry) => entry.state === 'OPEN') ??
        runtime.workspace.exceptions[0])
      : undefined;
  const selected = eventForFocus(
    entryMode,
    focus ?? defaultException?.deepLinkResourceId ?? null,
    runtime.workspace.events,
    runtime.workspace.exceptions
  );

  useEffect(() => {
    setFilter(entryMode === 'TIME_EXCEPTIONS' ? 'NEEDS_REVIEW' : 'ALL');
    if (!controlledFocus) setLocalFocus(null);
  }, [controlledFocus, entryMode]);

  useEffect(() => {
    if (!focus || runtime.workspace.state === 'LOADING') return;
    const valid =
      entryMode === 'CLOCK_INGESTION'
        ? runtime.workspace.events.some((event) => event.deepLinkResourceId === focus)
        : runtime.workspace.exceptions.some((entry) => entry.deepLinkResourceId === focus);
    const hasMore =
      entryMode === 'CLOCK_INGESTION'
        ? runtime.workspace.eventPage.nextCursor !== null
        : runtime.workspace.exceptionPage.nextCursor !== null;
    if (valid || hasMore) {
      invalidFocusRef.current = null;
      return;
    }
    if (controlledFocus) {
      if (invalidFocusRef.current !== focus) {
        invalidFocusRef.current = focus;
        onFocusResourceChange?.(null);
      }
    } else {
      setLocalFocus(null);
    }
  }, [
    controlledFocus,
    entryMode,
    focus,
    onFocusResourceChange,
    runtime.workspace.eventPage.nextCursor,
    runtime.workspace.events,
    runtime.workspace.exceptionPage.nextCursor,
    runtime.workspace.exceptions,
    runtime.workspace.state,
  ]);

  const setFocus = useCallback(
    (next: string | null) => {
      invalidFocusRef.current = null;
      if (!controlledFocus) setLocalFocus(next);
      onFocusResourceChange?.(next);
    },
    [controlledFocus, onFocusResourceChange]
  );

  const selectEvent = useCallback(
    (event: ClockEvent) => {
      if (entryMode === 'CLOCK_INGESTION') {
        setFocus(event.deepLinkResourceId);
        return;
      }
      const exception = runtime.workspace.exceptions.find(
        (entry) => entry.clockEventId === event.clockEventId
      );
      setFocus(exception?.deepLinkResourceId ?? null);
    },
    [entryMode, runtime.workspace.exceptions, setFocus]
  );

  const selectException = useCallback(
    (exception: ClockException) => {
      if (entryMode === 'TIME_EXCEPTIONS') {
        setFocus(exception.deepLinkResourceId);
        return;
      }
      const event = runtime.workspace.events.find(
        (candidate) => candidate.clockEventId === exception.clockEventId
      );
      setFocus(event?.deepLinkResourceId ?? null);
    },
    [entryMode, runtime.workspace.events, setFocus]
  );

  const feedback = commands.feedback;
  const retryingRecord = feedback?.kind === 'RESULT_UNKNOWN' && commands.pendingKind === 'RECORD';
  const retryingVoid = feedback?.kind === 'RESULT_UNKNOWN' && commands.pendingKind === 'VOID';

  return (
    <>
      <Stack gap={2}>
        {feedback?.kind === 'SUCCESS' && (
          <InlineFeedback severity="success" title={copy.commandSucceededTitle}>
            {copy.commandSucceededDescription} {feedback.receipt.receiptId}
          </InlineFeedback>
        )}
        {feedback?.kind === 'REJECTED' && (
          <InlineFeedback severity="error" title={copy.commandRejectedTitle}>
            {copy.commandRejectedDescription}
          </InlineFeedback>
        )}
        {feedback?.kind === 'RESULT_UNKNOWN' && (
          <InlineFeedback severity="warning" title={copy.resultUnknownTitle}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
              <span>{copy.resultUnknownDescription}</span>
              <ActionButton
                intent="secondary"
                size="small"
                disabled={commands.busy}
                onClick={() => void commands.retryExact()}
              >
                {copy.retryExact}
              </ActionButton>
            </Stack>
          </InlineFeedback>
        )}
        <ClockIngestionCommandCenter
          workspace={runtime.workspace}
          copy={copy}
          entryMode={entryMode}
          selectedEventId={selected?.clockEventId ?? null}
          filter={filter}
          busy={commands.busy}
          canIngest={Boolean(ownerBinding?.commands?.record)}
          canVoid={Boolean(ownerBinding?.commands?.voidEvent)}
          onSelectEvent={selectEvent}
          onSelectException={selectException}
          onFilterChange={setFilter}
          onRefresh={
            ownerBinding?.eventPage || ownerBinding?.exceptionPage ? runtime.reload : undefined
          }
          onIngest={
            entryMode === 'CLOCK_INGESTION' && ownerBinding?.commands?.record
              ? commands.openRecord
              : undefined
          }
          onVoid={ownerBinding?.commands?.voidEvent ? commands.openVoid : undefined}
          onLoadMoreEvents={
            ownerBinding?.eventPage ? () => void runtime.loadMoreEvents() : undefined
          }
          onLoadMoreExceptions={
            ownerBinding?.exceptionPage ? () => void runtime.loadMoreExceptions() : undefined
          }
          loadingMoreEvents={runtime.loadingMoreEvents}
          loadingMoreExceptions={runtime.loadingMoreExceptions}
        />
      </Stack>

      <ClockRecordDialog
        open={commands.recordOpen}
        busy={commands.busy}
        retryExact={retryingRecord}
        timeZone={scope.timeZone}
        defaults={ownerBinding?.commands?.recordDefaults}
        copy={copy}
        onClose={commands.closeRecord}
        onSubmit={commands.submitRecord}
        onRetryExact={commands.retryExact}
      />
      <ClockVoidDialog
        event={commands.busy && !retryingVoid ? null : commands.voidTarget}
        busy={commands.busy}
        retryExact={retryingVoid}
        copy={copy}
        onClose={commands.closeVoid}
        onSubmit={commands.submitVoid}
        onRetryExact={commands.retryExact}
      />
      {ownerBinding?.commands?.voidEvent && (
        <ProductSurfaceHighRiskCommandDialog
          controller={ownerBinding.commands.voidEvent.controller}
        />
      )}
    </>
  );
}
