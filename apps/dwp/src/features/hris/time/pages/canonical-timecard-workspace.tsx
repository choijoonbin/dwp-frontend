import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Edit3, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { ActionButton, LoadingState, LocalErrorState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TimecardCommandDialogs } from '../components/timecard-command-dialogs';
import { TimecardCommandNotice } from '../components/timecard-command-notice';
import { TimecardSummary } from '../components/timecard-summary';
import { useTimecardWorkspace } from '../hooks/use-timecard-workspace';

import type { TimecardDataSource } from '../api/timecard-api';
import type { TimecardDialogMode } from '../components/timecard-command-dialogs';
import type { TimecardOwnerBinding } from '../hooks/use-timecard-workspace';
import type { TimecardOperationScope } from '../model/timecard-model';

export type CanonicalTimecardWorkspaceProps = Readonly<{
  timecardId: string;
  scope: TimecardOperationScope;
  ownerBinding?: TimecardOwnerBinding;
  dataSource?: TimecardDataSource;
  idFactory?: () => string;
}>;

function closedCopy(reason: 'SCOPE' | 'OWNER_CONTRACT') {
  return reason === 'SCOPE'
    ? {
        title: 'Timecard access context is unavailable',
        description:
          'A complete current scope is required before the canonical record can be requested. No legacy fallback was used.',
      }
    : {
        title: 'Canonical timecard is not connected',
        description:
          'Exact owner read and receipt contracts are required. This unmounted workspace stays closed instead of reading an adjacent or legacy source.',
      };
}

function errorCopy(reason: 'DENIED' | 'UNAVAILABLE' | 'INVALID') {
  if (reason === 'DENIED') {
    return {
      title: 'Timecard is not available',
      description:
        'The canonical owner did not disclose a record for this current scope. No adjacent or legacy source was queried.',
    };
  }
  if (reason === 'INVALID') {
    return {
      title: 'Timecard response could not be verified',
      description:
        'The owner response did not match the sealed timecard and ETag contract, so the workspace remained closed.',
    };
  }
  return {
    title: 'Canonical timecard is temporarily unavailable',
    description: 'Nothing was changed. Retry the owner-bound read when the service is available.',
  };
}

function TimecardRefreshFailureNotice({
  reason,
  busy,
  onRefresh,
}: {
  reason: 'DENIED' | 'UNAVAILABLE' | 'INVALID';
  busy: boolean;
  onRefresh: () => void;
}) {
  const detail =
    reason === 'DENIED'
      ? 'The owner did not disclose a refreshed record for the current scope.'
      : reason === 'INVALID'
        ? 'The refreshed owner response could not be verified.'
        : 'The canonical owner could not be reached for a refreshed record.';
  return (
    <Paper
      variant="outlined"
      role="alert"
      aria-live="assertive"
      sx={{ p: 1.5, borderColor: 'warning.main', bgcolor: 'action.hover' }}
    >
      <Stack direction="row" gap={1} alignItems="flex-start">
        <AlertTriangle size={18} aria-hidden="true" />
        <Box minWidth={0} flex={1}>
          <Typography component="p" variant="subtitle2">
            Refresh failed — showing the last verified timecard
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25 }}>
            {detail} This view is stale and all commands remain disabled. Your draft is preserved.
          </Typography>
          <ActionButton
            intent="secondary"
            size="small"
            disabled={busy}
            startIcon={<RefreshCw size={14} aria-hidden="true" />}
            sx={{ mt: 1.25 }}
            onClick={onRefresh}
          >
            Retry canonical refresh
          </ActionButton>
        </Box>
      </Stack>
    </Paper>
  );
}

export function CanonicalTimecardWorkspace({
  timecardId,
  scope,
  ownerBinding,
  dataSource,
  idFactory,
}: CanonicalTimecardWorkspaceProps) {
  const runtime = useTimecardWorkspace({
    timecardId,
    scope,
    ownerBinding,
    dataSource,
    idFactory,
  });
  const [dialogMode, setDialogMode] = useState<TimecardDialogMode>(null);
  const handledSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    const receipt = runtime.feedback?.receipt;
    if (runtime.feedback?.status !== 'SUCCEEDED' || !receipt) return;
    if (handledSuccessRef.current === receipt.receiptId) return;
    handledSuccessRef.current = receipt.receiptId;
    setDialogMode(null);
  }, [runtime.feedback]);

  useEffect(() => {
    setDialogMode(null);
    handledSuccessRef.current = null;
  }, [
    timecardId,
    scope.ready,
    scope.contextScopeKey,
    scope.decisionRevision,
    scope.actorWorkerId,
    scope.populationKind,
    scope.timecardPurpose,
    scope.receiptPurpose,
  ]);

  if (runtime.readState.kind === 'CLOSED') {
    const copy = closedCopy(runtime.readState.reason);
    return <LocalErrorState size="page" title={copy.title} description={copy.description} />;
  }

  if (runtime.readState.kind === 'LOADING') {
    return <LoadingState size="page" label="Loading canonical timecard" />;
  }

  if (runtime.readState.kind === 'ERROR') {
    const copy = errorCopy(runtime.readState.reason);
    const canRetry = runtime.readState.reason === 'UNAVAILABLE';
    return (
      <LocalErrorState
        size="page"
        title={copy.title}
        description={copy.description}
        {...(canRetry
          ? {
              retryLabel: 'Retry canonical read',
              onRetry: runtime.refresh,
            }
          : {})}
      />
    );
  }

  const { snapshot } = runtime.readState;
  const refreshFailure = runtime.readState.refreshFailure;
  const anyAction = runtime.actions.correct || runtime.actions.submit || runtime.actions.decide;
  const interactionBusy = runtime.busy || runtime.refreshing;
  const activeDialogMode = runtime.feedback?.status === 'SUCCEEDED' ? null : dialogMode;
  const notice = (
    <>
      {refreshFailure && (
        <TimecardRefreshFailureNotice
          reason={refreshFailure}
          busy={interactionBusy}
          onRefresh={runtime.refresh}
        />
      )}
      <TimecardCommandNotice
        failure={runtime.failure}
        feedback={runtime.feedback}
        busy={interactionBusy}
        onRefresh={runtime.refresh}
        onRetry={runtime.retrySameCommand}
        onReconcile={() => void runtime.reconcileReceipt()}
      />
    </>
  );

  return (
    <Stack
      component="main"
      aria-labelledby="canonical-timecard-title"
      gap={{ xs: 2, md: 3 }}
      sx={{
        width: '100%',
        minWidth: 0,
        overflowWrap: 'anywhere',
        '& button': { whiteSpace: 'normal' },
        '@media (forced-colors: active)': {
          '& .MuiPaper-outlined': { borderColor: 'CanvasText' },
          '& [aria-current="step"]': { borderWidth: 2 },
          '& button:focus-visible': { outline: '2px solid CanvasText', outlineOffset: 2 },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&, & *, & *::before, & *::after': {
            scrollBehavior: 'auto !important',
            transitionDuration: '0s !important',
            animationDuration: '0s !important',
            animation: 'none !important',
          },
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        gap={2}
      >
        <Box minWidth={0}>
          <Typography id="canonical-timecard-title" component="h1" variant="h4">
            Canonical timecard
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
            Review owner-confirmed totals, state, version and durable command outcomes for timecard{' '}
            {snapshot.timecard.timecardId}.
          </Typography>
        </Box>
        <ActionButton
          intent="secondary"
          loading={runtime.refreshing}
          loadingLabel="Refreshing canonical timecard"
          disabled={interactionBusy}
          startIcon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={runtime.refresh}
        >
          Refresh
        </ActionButton>
      </Stack>

      <Paper component="aside" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" gap={1} alignItems="flex-start">
          <ShieldCheck size={19} aria-hidden="true" />
          <Box minWidth={0}>
            <Typography component="h2" variant="subtitle1">
              Owner-bound canonical record
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25 }}>
              This route-neutral workspace uses only the five sealed Time PEPs. It does not read,
              write or fall back to the active legacy timecard implementation.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {activeDialogMode === null && notice}

      <TimecardSummary timecard={snapshot.timecard} />

      <Paper component="section" variant="outlined" aria-labelledby="timecard-actions-title">
        <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: 1, borderColor: 'divider' }}>
          <Typography id="timecard-actions-title" component="h2" variant="h6">
            Available actions
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            Actions are shown only when the exact owner binding, current population and canonical
            state allow them. The owner re-evaluates authority when each command is dispatched.
          </Typography>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          flexWrap="wrap"
          gap={1}
          sx={{ p: { xs: 2, md: 2.5 } }}
        >
          {runtime.actions.correct && (
            <ActionButton
              intent="secondary"
              disabled={interactionBusy}
              startIcon={<Edit3 size={16} aria-hidden="true" />}
              onClick={() => setDialogMode('CORRECT')}
            >
              Record correction
            </ActionButton>
          )}
          {runtime.actions.submit && (
            <ActionButton
              intent="primary"
              disabled={interactionBusy}
              startIcon={<Send size={16} aria-hidden="true" />}
              onClick={() => setDialogMode('SUBMIT')}
            >
              Submit timecard
            </ActionButton>
          )}
          {runtime.actions.decide && (
            <ActionButton
              intent="primary"
              disabled={interactionBusy}
              startIcon={<ShieldCheck size={16} aria-hidden="true" />}
              onClick={() => setDialogMode('DECIDE')}
            >
              Record independent decision
            </ActionButton>
          )}
          {!anyAction && (
            <Typography role="status" color="text.secondary" variant="body2">
              This timecard is read only for the current state and authorization scope.
            </Typography>
          )}
        </Stack>
      </Paper>

      <TimecardCommandDialogs
        mode={activeDialogMode}
        timecard={snapshot.timecard}
        busy={interactionBusy}
        commandDisabled={refreshFailure !== undefined || runtime.failure?.kind === 'CONFLICT'}
        notice={notice}
        onClose={() => {
          if (!interactionBusy) setDialogMode(null);
        }}
        onCorrect={(command) => void runtime.correct(command)}
        onSubmit={(command) => void runtime.submit(command)}
        onDecide={(command) => void runtime.decide(command)}
      />
    </Stack>
  );
}
