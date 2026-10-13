import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionButton, InlineFeedback, LocalErrorState } from '@dwp-frontend/design-system';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  TimeInterpretationCommandOutcomeUnknownError,
  assertTimeInterpretationRunRequest,
  createTimeInterpretationDataSource,
} from '../api/time-interpretation-api';
import {
  assertTimeInterpretationReplayInvariant,
  timeInterpretationTotalMinutes,
} from '../model/time-interpretation-model';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  TimeInterpretationDataSource,
  TimeInterpretationRunRequest,
  TimeInterpretationScope,
} from '../api/time-interpretation-api';
import type {
  TimeInterpretationFieldDecision,
  TimeInterpretationItem,
  TimeInterpretationReceipt,
  TimeInterpretationTrace,
  TimeInterpretationWorkbench,
} from '../model/time-interpretation-model';

export type TimeInterpretationPageReader = TimeInterpretationDataSource['read'];
export type TimeInterpretationTraceReader = TimeInterpretationDataSource['trace'];

export type TimeInterpretationRunExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
  binding: Readonly<{
    actionKey: 'hris.action.tim.interpretation.run';
    idempotencyKey: string;
    request: TimeInterpretationRunRequest;
  }>
) => Promise<T>;

export type TimeInterpretationOwnerBinding = Readonly<{
  page?: Readonly<{
    contractId: 'IAQ-041';
    read: TimeInterpretationPageReader;
  }>;
  trace?: Readonly<{
    contractId: 'PEP-TIM-010';
    read: TimeInterpretationTraceReader;
  }>;
  run?: Readonly<{
    contractId: 'PEP-TIM-009';
    actionKey: 'hris.action.tim.interpretation.run';
    execute: TimeInterpretationRunExecutor;
  }>;
}>;

export type TimeInterpretationCopy = Readonly<{
  title: string;
  description: string;
  closedTitle: string;
  closedScopeDescription: string;
  closedOwnerDescription: string;
  loading: string;
  emptyTitle: string;
  emptyDescription: string;
  partialTitle: string;
  stale: string;
  current: string;
  unavailable: string;
  run: string;
  retryExact: string;
  refresh: string;
  result: string;
  ruleVersion: string;
  traceSteps: string;
  traceTitle: string;
  traceUnavailable: string;
  inputDigest: string;
  ruleDigest: string;
  inputMinutes: string;
  outputMinutes: string;
  totalMinutes: string;
  commandAcceptedTitle: string;
  commandAcceptedDescription: string;
  resultUnknownTitle: string;
  resultUnknownDescription: string;
  commandRejectedTitle: string;
  commandRejectedDescription: string;
  masked: string;
  omitted: string;
}>;

export const timeInterpretationCopy: TimeInterpretationCopy = Object.freeze({
  title: 'Time interpretation evidence',
  description:
    'Review deterministic minute totals against the sealed clock-input and typed-rule versions.',
  closedTitle: 'Time interpretation is not authorized',
  closedScopeDescription:
    'A tenant-scoped time operations decision is required before owner data can be requested.',
  closedOwnerDescription:
    'The exact IAQ-041 owner binding is unavailable. No adjacent time permission is reused.',
  loading: 'Loading interpretation evidence…',
  emptyTitle: 'No interpretation runs',
  emptyDescription: 'No deterministic interpretation evidence is available in this scope.',
  partialTitle: 'Some interpretation evidence is unavailable',
  stale: 'Stale',
  current: 'Current',
  unavailable: 'Unavailable',
  run: 'Run exact interpretation',
  retryExact: 'Retry exact command',
  refresh: 'Refresh',
  result: 'Result',
  ruleVersion: 'Typed rule version',
  traceSteps: 'Trace steps',
  traceTitle: 'Deterministic trace',
  traceUnavailable: 'The exact PEP-TIM-010 trace binding is unavailable for this run.',
  inputDigest: 'Clock input digest',
  ruleDigest: 'Typed rule digest',
  inputMinutes: 'Input minutes',
  outputMinutes: 'Output minutes',
  totalMinutes: 'Golden total minutes',
  commandAcceptedTitle: 'Interpretation command accepted',
  commandAcceptedDescription: 'The TIM owner returned a sealed command receipt.',
  resultUnknownTitle: 'Interpretation outcome is unknown',
  resultUnknownDescription:
    'Do not submit a new command. Retry with the preserved idempotency key.',
  commandRejectedTitle: 'Interpretation command rejected',
  commandRejectedDescription: 'The owner rejected the request before a safe receipt was recorded.',
  masked: 'Masked by field policy',
  omitted: 'Not disclosed',
});

type RuntimeState =
  | Readonly<{ kind: 'CLOSED' | 'LOADING' | 'ERROR'; scopeIdentity: string }>
  | Readonly<{
      kind: 'READY';
      scopeIdentity: string;
      workbench: TimeInterpretationWorkbench;
    }>;

type CommandFeedback =
  | Readonly<{ kind: 'ACCEPTED'; receipt: TimeInterpretationReceipt }>
  | Readonly<{ kind: 'RESULT_UNKNOWN' }>
  | Readonly<{ kind: 'REJECTED' }>;

type PendingCommand = Readonly<{
  scopeIdentity: string;
  idempotencyKey: string;
  request: TimeInterpretationRunRequest;
  observedReceipt?: TimeInterpretationReceipt;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function createCommandId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure TIM interpretation command identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

function secureAuthority(
  authority: ProductSurfaceGovernedMutationAuthority,
  idempotencyKey: string
): ProductSurfaceGovernedMutationAuthority {
  if (
    authority.mode !== 'SECURE' ||
    (authority.idempotencyKey !== undefined && authority.idempotencyKey !== idempotencyKey)
  ) {
    throw new Error('Secure TIM interpretation authority is required.');
  }
  return { ...authority, idempotencyKey };
}

function ambiguous(error: unknown): boolean {
  return (
    error instanceof TimeInterpretationCommandOutcomeUnknownError ||
    error instanceof HttpTransportError ||
    (error instanceof HttpError &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}

function fieldText<T>(
  decision: TimeInterpretationFieldDecision<T>,
  copy: TimeInterpretationCopy,
  render: (value: T) => string
): string {
  if (decision.decision === 'VIEW') return render(decision.value);
  return decision.decision === 'MASK' ? copy.masked : copy.omitted;
}

function hasRunAction(item: TimeInterpretationItem | null): boolean {
  return Boolean(
    item?.availableActions.some(
      (action) =>
        action.actionKey === 'hris.action.tim.interpretation.run' &&
        action.hrefTemplate === '/api/time/v1/interpretation-runs' &&
        action.idempotencyPolicy === 'REQUIRED_IDEMPOTENCY_KEY'
    )
  );
}

function WorkbenchTable({
  workbench,
  selectedRunId,
  copy,
  onSelect,
}: Readonly<{
  workbench: TimeInterpretationWorkbench;
  selectedRunId: string | null;
  copy: TimeInterpretationCopy;
  onSelect: (runId: string) => void;
}>) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <table
        aria-label="Time interpretation evidence"
        style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}
      >
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">{copy.result}</th>
            <th scope="col">{copy.ruleVersion}</th>
            <th scope="col">{copy.traceSteps}</th>
          </tr>
        </thead>
        <tbody>
          {workbench.items.map((item) => (
            <tr key={item.runId} aria-selected={item.runId === selectedRunId}>
              <th scope="row">
                <button type="button" onClick={() => onSelect(item.runId)}>
                  {item.title}
                </button>
              </th>
              <td>
                {fieldText(item.result, copy, (value) => `${value.code} · r${value.revision}`)}
              </td>
              <td>
                {fieldText(
                  item.ruleVersion,
                  copy,
                  (value) => `${value.policyKey} · r${value.revision} · ${value.status}`
                )}
              </td>
              <td>
                {fieldText(
                  item.traceSummary,
                  copy,
                  (value) => `${value.itemCount} · r${value.revision}`
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function WorkbenchAgenda({
  workbench,
  selectedRunId,
  copy,
  onSelect,
}: Readonly<{
  workbench: TimeInterpretationWorkbench;
  selectedRunId: string | null;
  copy: TimeInterpretationCopy;
  onSelect: (runId: string) => void;
}>) {
  return (
    <Box
      component="ul"
      aria-label="Time interpretation agenda"
      sx={{ m: 0, p: 0, display: { md: 'none' } }}
    >
      {workbench.items.map((item) => (
        <Box component="li" key={item.runId} sx={{ listStyle: 'none', mb: 1 }}>
          <button
            type="button"
            aria-pressed={item.runId === selectedRunId}
            onClick={() => onSelect(item.runId)}
          >
            {item.title} — {fieldText(item.result, copy, (value) => value.code)}
          </button>
        </Box>
      ))}
    </Box>
  );
}

function TracePanel({
  trace,
  loading,
  available,
  copy,
}: Readonly<{
  trace: TimeInterpretationTrace | null;
  loading: boolean;
  available: boolean;
  copy: TimeInterpretationCopy;
}>) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Typography component="h2" variant="h6">
        {copy.traceTitle}
      </Typography>
      {loading ? (
        <Typography>{copy.loading}</Typography>
      ) : !available || !trace ? (
        <Typography color="text.secondary">{copy.traceUnavailable}</Typography>
      ) : (
        <Stack gap={2}>
          <dl>
            <dt>{copy.inputDigest}</dt>
            <dd>{trace.inputDigest}</dd>
            <dt>{copy.ruleDigest}</dt>
            <dd>{trace.ruleDigest}</dd>
            <dt>{copy.totalMinutes}</dt>
            <dd>{timeInterpretationTotalMinutes(trace) ?? copy.unavailable}</dd>
          </dl>
          <Box sx={{ overflowX: 'auto' }}>
            <table
              aria-label="Deterministic interpretation trace"
              style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}
            >
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Rule</th>
                  <th scope="col">{copy.inputMinutes}</th>
                  <th scope="col">{copy.outputMinutes}</th>
                </tr>
              </thead>
              <tbody>
                {trace.steps.map((step) => (
                  <tr key={step.sequence}>
                    <td>{step.sequence}</td>
                    <th scope="row">{step.ruleCode}</th>
                    <td>{step.inputMinutes}</td>
                    <td>{step.outputMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Stack>
      )}
    </Paper>
  );
}

export type TimeInterpretationWorkbenchViewProps = Readonly<{
  workbench: TimeInterpretationWorkbench;
  selectedRunId: string | null;
  trace: TimeInterpretationTrace | null;
  traceLoading: boolean;
  traceAvailable: boolean;
  busy: boolean;
  runAvailable: boolean;
  feedback: CommandFeedback | null;
  copy?: TimeInterpretationCopy;
  onSelect: (runId: string) => void;
  onRun: () => void;
  onRetryExact: () => void;
  onRefresh: () => void;
}>;

export function TimeInterpretationWorkbenchView({
  workbench,
  selectedRunId,
  trace,
  traceLoading,
  traceAvailable,
  busy,
  runAvailable,
  feedback,
  copy = timeInterpretationCopy,
  onSelect,
  onRun,
  onRetryExact,
  onRefresh,
}: TimeInterpretationWorkbenchViewProps) {
  return (
    <Stack gap={2} data-testid="time-interpretation-workbench">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }}
        gap={2}
      >
        <Box>
          <Typography component="h1" variant="h4">
            {copy.title}
          </Typography>
          <Typography color="text.secondary">{copy.description}</Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip
            label={workbench.freshness === 'CURRENT' ? copy.current : copy.stale}
            color={workbench.freshness === 'CURRENT' ? 'success' : 'warning'}
            size="small"
          />
          <ActionButton intent="secondary" size="small" disabled={busy} onClick={onRefresh}>
            {copy.refresh}
          </ActionButton>
        </Stack>
      </Stack>

      {workbench.queryState === 'PARTIAL' && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {workbench.partialFailures.join(', ')}
        </InlineFeedback>
      )}
      {feedback?.kind === 'ACCEPTED' && (
        <InlineFeedback severity="success" title={copy.commandAcceptedTitle}>
          {copy.commandAcceptedDescription} {feedback.receipt.receiptId}
        </InlineFeedback>
      )}
      {feedback?.kind === 'RESULT_UNKNOWN' && (
        <InlineFeedback severity="warning" title={copy.resultUnknownTitle}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
            <span>{copy.resultUnknownDescription}</span>
            <ActionButton intent="secondary" size="small" disabled={busy} onClick={onRetryExact}>
              {copy.retryExact}
            </ActionButton>
          </Stack>
        </InlineFeedback>
      )}
      {feedback?.kind === 'REJECTED' && (
        <InlineFeedback severity="error" title={copy.commandRejectedTitle}>
          {copy.commandRejectedDescription}
        </InlineFeedback>
      )}

      {workbench.items.length === 0 ? (
        <LocalErrorState title={copy.emptyTitle} description={copy.emptyDescription} size="page" />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 3fr) minmax(320px, 2fr)' },
            gap: 2,
          }}
        >
          <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <WorkbenchTable
                workbench={workbench}
                selectedRunId={selectedRunId}
                copy={copy}
                onSelect={onSelect}
              />
            </Box>
            <WorkbenchAgenda
              workbench={workbench}
              selectedRunId={selectedRunId}
              copy={copy}
              onSelect={onSelect}
            />
            <Box sx={{ mt: 2 }}>
              <ActionButton disabled={!runAvailable || busy} onClick={onRun}>
                {copy.run}
              </ActionButton>
            </Box>
          </Paper>
          <TracePanel trace={trace} loading={traceLoading} available={traceAvailable} copy={copy} />
        </Box>
      )}
    </Stack>
  );
}

export type TimeInterpretationWorkbenchRuntimeProps = Readonly<{
  scope: TimeInterpretationScope;
  ownerBinding?: TimeInterpretationOwnerBinding;
  runRequest?: TimeInterpretationRunRequest;
  dataSource?: TimeInterpretationDataSource;
  copy?: TimeInterpretationCopy;
  idFactory?: () => string;
}>;

const productionDataSource = createTimeInterpretationDataSource();

export function TimeInterpretationWorkbenchRuntime({
  scope,
  ownerBinding,
  runRequest,
  dataSource = productionDataSource,
  copy = timeInterpretationCopy,
  idFactory = createCommandId,
}: TimeInterpretationWorkbenchRuntimeProps) {
  const scopeIdentity = JSON.stringify([
    scope.ready,
    scope.contextScopeKey,
    scope.decisionRevision,
    scope.locale,
    scope.timeZone,
    scope.correlationId,
  ]);
  const currentScopeIdentityRef = useRef(scopeIdentity);
  currentScopeIdentityRef.current = scopeIdentity;
  const readScopeIdentityRef = useRef(scopeIdentity);
  const mountedRef = useRef(true);
  const commandBusyRef = useRef(false);
  const pendingRef = useRef<PendingCommand | null>(null);
  const commandAbortRef = useRef<AbortController | null>(null);
  const [reloadRevision, setReloadRevision] = useState(0);
  const [state, setState] = useState<RuntimeState>({ kind: 'CLOSED', scopeIdentity });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [trace, setTrace] = useState<TimeInterpretationTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<CommandFeedback | null>(null);

  const pageReader =
    ownerBinding?.page?.contractId === 'IAQ-041' ? ownerBinding.page.read : undefined;
  const traceReader =
    ownerBinding?.trace?.contractId === 'PEP-TIM-010' ? ownerBinding.trace.read : undefined;
  const runBinding =
    ownerBinding?.run?.contractId === 'PEP-TIM-009' &&
    ownerBinding.run.actionKey === 'hris.action.tim.interpretation.run'
      ? ownerBinding.run
      : undefined;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      commandAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const scopeChanged = readScopeIdentityRef.current !== scopeIdentity;
    readScopeIdentityRef.current = scopeIdentity;
    if (scopeChanged) {
      commandAbortRef.current?.abort();
      commandAbortRef.current = null;
      commandBusyRef.current = false;
      pendingRef.current = null;
      setBusy(false);
      setFeedback(null);
      setSelectedRunId(null);
      setTrace(null);
    }
    if (!scope.ready || !pageReader) {
      setState({ kind: 'CLOSED', scopeIdentity });
      return;
    }
    const abort = new AbortController();
    setState({ kind: 'LOADING', scopeIdentity });
    void pageReader(scope, {}, abort.signal)
      .then((workbench) => {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentScopeIdentityRef.current !== scopeIdentity
        ) {
          return;
        }
        setState({ kind: 'READY', scopeIdentity, workbench });
        setSelectedRunId((current) =>
          workbench.items.some((item) => item.runId === current)
            ? current
            : (workbench.items[0]?.runId ?? null)
        );
      })
      .catch(() => {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentScopeIdentityRef.current !== scopeIdentity
        ) {
          return;
        }
        setState({ kind: 'ERROR', scopeIdentity });
      });
    return () => abort.abort();
  }, [pageReader, reloadRevision, scope, scopeIdentity]);

  const workbench =
    state.kind === 'READY' && state.scopeIdentity === scopeIdentity ? state.workbench : null;
  const selected =
    workbench?.items.find((item) => item.runId === selectedRunId) ?? workbench?.items[0] ?? null;

  useEffect(() => {
    setTrace(null);
    if (!selected || !traceReader || !scope.ready || !UUID.test(selected.runId)) {
      setTraceLoading(false);
      return;
    }
    const abort = new AbortController();
    setTraceLoading(true);
    void traceReader(selected.runId, scope, abort.signal)
      .then((nextTrace) => {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentScopeIdentityRef.current !== scopeIdentity ||
          nextTrace.runId.toLowerCase() !== selected.runId.toLowerCase()
        ) {
          return;
        }
        setTrace(nextTrace);
      })
      .catch(() => {
        if (!abort.signal.aborted && currentScopeIdentityRef.current === scopeIdentity) {
          setTrace(null);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted && currentScopeIdentityRef.current === scopeIdentity) {
          setTraceLoading(false);
        }
      });
    return () => abort.abort();
  }, [scope, scopeIdentity, selected, traceReader]);

  const execute = useCallback(
    async (command: PendingCommand) => {
      if (
        commandBusyRef.current ||
        currentScopeIdentityRef.current !== command.scopeIdentity ||
        !runBinding ||
        !scope.ready
      ) {
        return;
      }
      commandBusyRef.current = true;
      setBusy(true);
      setFeedback(null);
      const abort = new AbortController();
      commandAbortRef.current = abort;
      let receipt: TimeInterpretationReceipt | undefined;
      try {
        receipt = await runBinding.execute(
          async (authority) => {
            if (abort.signal.aborted || currentScopeIdentityRef.current !== command.scopeIdentity) {
              throw new HttpTransportError('ABORT');
            }
            return dataSource.run(
              command.request,
              scope,
              secureAuthority(authority, command.idempotencyKey),
              abort.signal
            );
          },
          {
            actionKey: 'hris.action.tim.interpretation.run',
            idempotencyKey: command.idempotencyKey,
            request: command.request,
          }
        );
        if (command.observedReceipt) {
          assertTimeInterpretationReplayInvariant(command.observedReceipt, receipt);
        }
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentScopeIdentityRef.current !== command.scopeIdentity
        ) {
          return;
        }
        if (receipt.status === 'RESULT_UNKNOWN') {
          const pending = { ...command, observedReceipt: receipt };
          pendingRef.current = pending;
          setFeedback({ kind: 'RESULT_UNKNOWN' });
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'ACCEPTED', receipt });
          setReloadRevision((value) => value + 1);
        }
      } catch (error) {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentScopeIdentityRef.current !== command.scopeIdentity
        ) {
          return;
        }
        if (receipt || ambiguous(error)) {
          pendingRef.current = { ...command, ...(receipt ? { observedReceipt: receipt } : {}) };
          setFeedback({ kind: 'RESULT_UNKNOWN' });
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'REJECTED' });
        }
      } finally {
        if (commandAbortRef.current === abort) {
          commandAbortRef.current = null;
          commandBusyRef.current = false;
          if (mountedRef.current && currentScopeIdentityRef.current === command.scopeIdentity) {
            setBusy(false);
          }
        }
      }
    },
    [dataSource, runBinding, scope]
  );

  const startRun = useCallback(() => {
    if (
      !runRequest ||
      !runBinding ||
      !hasRunAction(selected) ||
      commandBusyRef.current ||
      pendingRef.current ||
      currentScopeIdentityRef.current !== scopeIdentity
    ) {
      return;
    }
    try {
      assertTimeInterpretationRunRequest(runRequest);
      const idempotencyKey = idFactory();
      if (!UUID.test(idempotencyKey)) throw new Error('Invalid command identity.');
      const command = Object.freeze({
        scopeIdentity,
        idempotencyKey,
        request: Object.freeze({
          ...runRequest,
          workerIds: Object.freeze([...runRequest.workerIds]),
        }),
      });
      pendingRef.current = command;
      void execute(command);
    } catch {
      pendingRef.current = null;
      setFeedback({ kind: 'REJECTED' });
    }
  }, [execute, idFactory, runBinding, runRequest, scopeIdentity, selected]);

  const retryExact = useCallback(() => {
    const pending = pendingRef.current;
    if (pending && pending.scopeIdentity === scopeIdentity) void execute(pending);
  }, [execute, scopeIdentity]);

  const refresh = useCallback(() => setReloadRevision((value) => value + 1), []);

  if (!scope.ready) {
    return (
      <div data-testid="time-interpretation-closed">
        <LocalErrorState
          title={copy.closedTitle}
          description={copy.closedScopeDescription}
          size="page"
        />
      </div>
    );
  }
  if (state.kind === 'CLOSED') {
    return (
      <div data-testid="time-interpretation-closed">
        <LocalErrorState
          title={copy.closedTitle}
          description={copy.closedOwnerDescription}
          size="page"
        />
      </div>
    );
  }
  if (state.scopeIdentity !== scopeIdentity) {
    return <Typography role="status">{copy.loading}</Typography>;
  }
  if (state.kind === 'LOADING') {
    return <Typography role="status">{copy.loading}</Typography>;
  }
  if (state.kind === 'ERROR') {
    return (
      <LocalErrorState
        title={copy.unavailable}
        description={copy.closedOwnerDescription}
        size="page"
      />
    );
  }
  if (state.kind !== 'READY') {
    return <Typography role="status">{copy.loading}</Typography>;
  }

  const exactRunAvailable = Boolean(
    runRequest && runBinding && hasRunAction(selected) && !pendingRef.current
  );
  return (
    <TimeInterpretationWorkbenchView
      workbench={state.workbench}
      selectedRunId={selected?.runId ?? null}
      trace={trace}
      traceLoading={traceLoading}
      traceAvailable={Boolean(traceReader && selected && UUID.test(selected.runId))}
      busy={busy}
      runAvailable={exactRunAvailable}
      feedback={feedback}
      copy={copy}
      onSelect={setSelectedRunId}
      onRun={startRun}
      onRetryExact={retryExact}
      onRefresh={refresh}
    />
  );
}
