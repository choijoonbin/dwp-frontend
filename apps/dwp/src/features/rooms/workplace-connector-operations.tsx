import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, PlayCircle, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getWorkplaceConnectorOperation,
  getWorkplaceConnectorOperations,
  getWorkplaceConnectorReplay,
  previewWorkplaceConnectorReplay,
  startWorkplaceConnectorReplay,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  DateTimePickerField,
  FormField,
  InlineFeedback,
  foundationTokens,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { GovernanceLoading, GovernancePanel } from './workplace-admin-governance-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import {
  canPreviewWorkplaceConnectorReplay,
  defaultWorkplaceConnectorReplayWindow,
  replayDateTimeToInstant,
  summarizeWorkplaceConnectorRuntime,
  workplaceConnectorRuntimeTone,
} from './workplace-connector-operations-model';
import {
  clearWorkplaceConnectorReplayCommand,
  createFrozenWorkplaceConnectorReplayCommand,
  isWorkplaceConnectorReplayPreviewExpired,
  persistWorkplaceConnectorReplayCommand,
  restoreWorkplaceConnectorReplayCommand,
} from './workplace-connector-replay-command';
import {
  isAmbiguousWorkplaceConnectorReplayFailure,
  isDefinitiveWorkplaceConnectorReplayFailure,
} from './workplace-connector-replay-failure';

import type {
  WorkplaceConnectorCommandReceipt,
  WorkplaceConnectorKind,
  WorkplaceConnectorReplayJob,
  WorkplaceConnectorReplayPreview,
  WorkplaceConnectorReplayPreviewInput,
  WorkplaceConnectorRuntimeTruth,
} from '@dwp-frontend/shared-utils';
import type { FrozenWorkplaceConnectorReplayCommand } from './workplace-connector-replay-command';

type FrozenReplayPreviewCommand = Readonly<{
  input: WorkplaceConnectorReplayPreviewInput;
  idempotencyKey: string;
  correlationId: string;
}>;

function displayTime(value: string | null, locale: string) {
  return value
    ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, resolveSupportedLocale(locale))
    : '—';
}

function RuntimeFact({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        sx={{ m: 0, mt: 0.35, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function ReplayStatus({
  job,
  receipt,
  refreshing,
  onRefresh,
}: {
  job: WorkplaceConnectorReplayJob;
  receipt: WorkplaceConnectorCommandReceipt | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const unknown = job.state === 'RESULT_UNKNOWN';
  return (
    <Stack spacing={1.25} data-testid="workplace-connector-replay-status">
      <InlineFeedback
        severity={unknown ? 'warning' : job.state === 'FAILED' ? 'error' : 'info'}
        action={
          <ActionButton
            intent="quiet"
            loading={refreshing}
            startIcon={<RefreshCw size={15} />}
            onClick={onRefresh}
          >
            {t('workplace.experience.connectorRuntime.replay.refreshStatus')}
          </ActionButton>
        }
      >
        {t(`workplace.experience.connectorRuntime.replay.states.${job.state}`)}
      </InlineFeedback>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1,
          m: 0,
        }}
      >
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.replay.commandId')}
          value={job.jobId}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.replay.acceptedAt')}
          value={displayTime(receipt?.acceptedAt ?? job.requestedAt, i18n.language)}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.replay.correlationId')}
          value={receipt?.correlationId ?? '—'}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.replay.providerReference')}
          value={job.providerOperationReference ?? '—'}
        />
      </Box>
      {job.resultSummary ? <Typography variant="body2">{job.resultSummary}</Typography> : null}
    </Stack>
  );
}

function ConnectorReplayWorkflow({
  connector,
  canManage,
  sourceReady,
  recoveryScope,
  onCompleted,
}: {
  connector: WorkplaceConnectorRuntimeTruth;
  canManage: boolean;
  sourceReady: boolean;
  recoveryScope: string | null;
  onCompleted: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const authority = useProductSurfaceAuthority();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const initialWindow = useMemo(
    () => defaultWorkplaceConnectorReplayWindow(connector.evaluatedAt),
    [connector.evaluatedAt]
  );
  const [recoveryCommand, setRecoveryCommand] =
    useState<FrozenWorkplaceConnectorReplayCommand | null>(() =>
      restoreWorkplaceConnectorReplayCommand(recoveryScope, connector.kind)
    );
  const [open, setOpen] = useState(Boolean(recoveryCommand));
  const [from, setFrom] = useState<string | null>(initialWindow.from);
  const [to, setTo] = useState<string | null>(initialWindow.to);
  const [failedOnly, setFailedOnly] = useState(true);
  const [maximumRecords, setMaximumRecords] = useState(500);
  const [preview, setPreview] = useState<WorkplaceConnectorReplayPreview | null>(
    recoveryCommand?.preview ?? null
  );
  const previewCommandRef = useRef<FrozenReplayPreviewCommand | null>(null);
  const [reason, setReason] = useState(recoveryCommand?.input.reason ?? '');
  const [confirmed, setConfirmed] = useState(recoveryCommand?.input.explicitConfirmation ?? false);
  const [clock, setClock] = useState(Date.now);
  const [receipt, setReceipt] = useState<WorkplaceConnectorCommandReceipt | null>(null);
  const [startedJob, setStartedJob] = useState<WorkplaceConnectorReplayJob | null>(null);
  const reconciledPreviewIdRef = useRef<string | null>(null);
  const jobId = startedJob?.jobId ?? connector.activeReplayJobId;
  const jobQuery = useQuery({
    queryKey: ['workplace', 'connector-replay', connector.kind, jobId],
    queryFn: () => getWorkplaceConnectorReplay(connector.kind, jobId!),
    enabled: Boolean(jobId),
    initialData: startedJob ?? undefined,
    refetchInterval: (query) =>
      query.state.data && ['QUEUED', 'DISPATCHING', 'RUNNING'].includes(query.state.data.state)
        ? 2_000
        : false,
    retry: retryRecoverableWorkplaceRead,
  });
  const currentJob = jobQuery.data ?? startedJob;
  const serverReconciled = Boolean(
    recoveryCommand && currentJob?.previewId === recoveryCommand.input.previewId
  );
  const recoveryReconciled = Boolean(
    recoveryCommand &&
    (serverReconciled || reconciledPreviewIdRef.current === recoveryCommand.input.previewId)
  );
  const unresolvedCommand = recoveryReconciled ? null : recoveryCommand;
  useEffect(() => {
    if (!serverReconciled || !recoveryCommand) return;
    reconciledPreviewIdRef.current = recoveryCommand.input.previewId;
    clearWorkplaceConnectorReplayCommand(recoveryScope, connector.kind);
  }, [connector.kind, recoveryCommand, recoveryScope, serverReconciled]);
  useEffect(() => {
    if (!preview || isWorkplaceConnectorReplayPreviewExpired(preview, clock)) return;
    const remaining = Date.parse(preview.expiresAt) - Date.now();
    const timeout = window.setTimeout(
      () => setClock(Date.now()),
      Math.min(Math.max(remaining + 25, 25), 1_000)
    );
    return () => window.clearTimeout(timeout);
  }, [clock, preview]);
  const fromInstant = replayDateTimeToInstant(from);
  const toInstant = replayDateTimeToInstant(to);
  const previewExpired = preview ? isWorkplaceConnectorReplayPreviewExpired(preview, clock) : false;
  const validWindow = Boolean(
    fromInstant &&
    toInstant &&
    Date.parse(toInstant) > Date.parse(fromInstant) &&
    Date.parse(toInstant) - Date.parse(fromInstant) <= 7 * 24 * 60 * 60 * 1000
  );
  const previewMutation = useMutation({
    mutationFn: (command: FrozenReplayPreviewCommand) =>
      previewWorkplaceConnectorReplay(connector.kind, command.input, {
        idempotencyKey: command.idempotencyKey,
        activeAccessMode: 'ELEVATED',
        correlationId: command.correlationId,
      }),
    onSuccess: (result) => {
      previewCommandRef.current = null;
      setPreview(result);
      setClock(Date.now());
      setReason('');
      setConfirmed(false);
      setReceipt(null);
      setStartedJob(null);
    },
    onError: (error) => {
      if (isDefinitiveWorkplaceConnectorReplayFailure(error)) previewCommandRef.current = null;
    },
  });
  const startMutation = useMutation({
    mutationFn: (command: FrozenWorkplaceConnectorReplayCommand) =>
      startWorkplaceConnectorReplay(command.kind, command.input, {
        idempotencyKey: command.idempotencyKey,
        activeAccessMode: 'ELEVATED',
        correlationId: command.correlationId,
      }),
    onSuccess: async (result, command) => {
      clearWorkplaceConnectorReplayCommand(recoveryScope, command.kind);
      setRecoveryCommand(null);
      setReceipt(result.receipt);
      setStartedJob(result.job);
      queryClient.setQueryData(
        ['workplace', 'connector-replay', connector.kind, result.job.jobId],
        result.job
      );
      await onCompleted();
    },
    onError: (error, command) => {
      if (isAmbiguousWorkplaceConnectorReplayFailure(error)) return;
      clearWorkplaceConnectorReplayCommand(recoveryScope, command.kind);
      setRecoveryCommand(null);
    },
  });
  const previewRecoveryCommand =
    previewMutation.isError && isAmbiguousWorkplaceConnectorReplayFailure(previewMutation.error)
      ? previewCommandRef.current
      : null;
  const commandLocked = Boolean(unresolvedCommand) || startMutation.isPending;
  const controlsLocked =
    commandLocked || previewMutation.isPending || Boolean(previewRecoveryCommand);
  const canCreatePreview =
    canManage &&
    sourceReady &&
    elevated &&
    !commandLocked &&
    canPreviewWorkplaceConnectorReplay(connector) &&
    validWindow &&
    maximumRecords >= 1 &&
    maximumRecords <= 100_000;
  const canSubmitPreview = previewRecoveryCommand
    ? canManage && sourceReady && elevated && !commandLocked && !previewMutation.isPending
    : canCreatePreview && !previewMutation.isPending;
  const canStart = Boolean(
    preview?.eligible &&
    !previewExpired &&
    reason.trim() &&
    reason.trim().length <= 500 &&
    confirmed &&
    elevated &&
    Boolean(recoveryScope) &&
    !currentJob &&
    preview?.previewId !== reconciledPreviewIdRef.current &&
    !controlsLocked
  );
  const submitPreview = () => {
    let command = previewRecoveryCommand;
    if (!command) {
      if (!fromInstant || !toInstant || connector.runtimeVersion === null) return;
      command = Object.freeze({
        input: Object.freeze({
          from: fromInstant,
          to: toInstant,
          failedOnly,
          maximumRecords,
          configurationVersion: connector.configurationVersion,
          runtimeVersion: connector.runtimeVersion,
        }),
        idempotencyKey: `workplace:connector-replay-preview:${crypto.randomUUID()}`,
        correlationId: crypto.randomUUID(),
      });
      previewCommandRef.current = command;
    }
    previewMutation.mutate(command);
  };
  const submitStart = () => {
    if (!preview || previewExpired || !canStart) return;
    const command = createFrozenWorkplaceConnectorReplayCommand({
      kind: connector.kind,
      preview,
      input: {
        previewId: preview.previewId,
        configurationVersion: preview.configurationVersion,
        runtimeVersion: preview.runtimeVersion,
        reason,
        explicitConfirmation: confirmed,
      },
      idempotencyKey: `workplace:connector-replay:${crypto.randomUUID()}`,
      correlationId: crypto.randomUUID(),
    });
    reconciledPreviewIdRef.current = null;
    persistWorkplaceConnectorReplayCommand(recoveryScope, command);
    setRecoveryCommand(command);
    startMutation.mutate(command);
  };
  const recoverStart = () => {
    if (!unresolvedCommand || !canManage || !elevated) return;
    startMutation.mutate(unresolvedCommand);
  };
  const reset = () => {
    if (controlsLocked) return;
    clearWorkplaceConnectorReplayCommand(recoveryScope, connector.kind);
    setRecoveryCommand(null);
    setOpen(false);
    setPreview(null);
    setReceipt(null);
    setStartedJob(null);
    setReason('');
    setConfirmed(false);
    reconciledPreviewIdRef.current = null;
    previewCommandRef.current = null;
    previewMutation.reset();
    startMutation.reset();
  };
  const invalidatePreview = () => {
    setPreview(null);
  };

  if (!open && !currentJob) {
    return (
      <ActionButton
        intent="secondary"
        startIcon={<PlayCircle size={16} />}
        disabled={!canManage || !sourceReady || !canPreviewWorkplaceConnectorReplay(connector)}
        onClick={() => setOpen(true)}
      >
        {t('workplace.experience.connectorRuntime.replay.review')}
      </ActionButton>
    );
  }

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
      }}
      data-testid="workplace-connector-replay-workflow"
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="subtitle2">
          {t('workplace.experience.connectorRuntime.replay.title')}
        </Typography>
        <ActionButton intent="quiet" disabled={controlsLocked} onClick={reset}>
          {t('actions.close')}
        </ActionButton>
      </Stack>
      {currentJob ? (
        <ReplayStatus
          job={currentJob}
          receipt={receipt}
          refreshing={jobQuery.isFetching}
          onRefresh={() => void jobQuery.refetch()}
        />
      ) : (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25}>
            <DateTimePickerField
              label={t('workplace.experience.connectorRuntime.replay.from')}
              value={from}
              disabled={controlsLocked}
              onValueChange={(value) => {
                setFrom(value);
                invalidatePreview();
              }}
            />
            <DateTimePickerField
              label={t('workplace.experience.connectorRuntime.replay.to')}
              value={to}
              disabled={controlsLocked}
              onValueChange={(value) => {
                setTo(value);
                invalidatePreview();
              }}
            />
            <FormField
              type="number"
              label={t('workplace.experience.connectorRuntime.replay.maximumRecords')}
              value={maximumRecords}
              disabled={controlsLocked}
              inputProps={{ min: 1, max: 100_000 }}
              onChange={(event) => {
                setMaximumRecords(Number(event.target.value));
                invalidatePreview();
              }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={failedOnly}
                disabled={controlsLocked}
                onChange={(event) => {
                  setFailedOnly(event.target.checked);
                  invalidatePreview();
                }}
              />
            }
            label={t('workplace.experience.connectorRuntime.replay.failedOnly')}
          />
          {!validWindow ? (
            <InlineFeedback severity="error">
              {t('workplace.experience.connectorRuntime.replay.invalidWindow')}
            </InlineFeedback>
          ) : null}
          {!elevated && !preview ? (
            <InlineFeedback severity="warning" icon={<ShieldAlert size={17} />}>
              {t('workplace.experience.connectorRuntime.replay.elevatedRequired')}
            </InlineFeedback>
          ) : null}
          <ActionButton
            intent="secondary"
            loading={previewMutation.isPending}
            disabled={!canSubmitPreview}
            onClick={submitPreview}
          >
            {t(
              previewRecoveryCommand
                ? 'workplace.experience.connectorRuntime.replay.retryPreview'
                : previewExpired
                  ? 'workplace.experience.connectorRuntime.replay.freshPreview'
                  : 'workplace.experience.connectorRuntime.replay.preview'
            )}
          </ActionButton>
          {previewMutation.isError ? (
            <InlineFeedback
              severity={
                isAmbiguousWorkplaceConnectorReplayFailure(previewMutation.error)
                  ? 'warning'
                  : 'error'
              }
            >
              {t(
                isAmbiguousWorkplaceConnectorReplayFailure(previewMutation.error)
                  ? 'workplace.experience.connectorRuntime.replay.previewUnknown'
                  : 'workplace.experience.connectorRuntime.replay.previewError'
              )}
            </InlineFeedback>
          ) : null}
          {preview ? (
            <Stack spacing={1.25} data-testid="workplace-connector-replay-impact">
              <InlineFeedback severity={preview.eligible && !previewExpired ? 'info' : 'warning'}>
                {t('workplace.experience.connectorRuntime.replay.impact', {
                  count: preview.estimatedRecords,
                  time: displayTime(preview.expiresAt, i18n.language),
                })}
              </InlineFeedback>
              {previewExpired ? (
                <InlineFeedback severity="warning">
                  {t('workplace.experience.connectorRuntime.replay.previewExpired')}
                </InlineFeedback>
              ) : null}
              {preview.limitations.length ? (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {preview.limitations.map((limitation) => (
                    <Typography component="li" variant="body2" key={limitation}>
                      {limitation}
                    </Typography>
                  ))}
                </Box>
              ) : null}
              <FormField
                label={t('workplace.experience.connectorRuntime.replay.reason')}
                value={reason}
                required
                multiline
                minRows={2}
                disabled={commandLocked || previewExpired}
                inputProps={{ maxLength: 500 }}
                onChange={(event) => setReason(event.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmed}
                    disabled={commandLocked || previewExpired}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                }
                label={t('workplace.experience.connectorRuntime.replay.confirm')}
              />
              {!elevated ? (
                <InlineFeedback severity="warning" icon={<ShieldAlert size={17} />}>
                  {t('workplace.experience.connectorRuntime.replay.elevatedRequired')}
                </InlineFeedback>
              ) : null}
              {unresolvedCommand && !startMutation.isPending ? (
                <InlineFeedback
                  severity="warning"
                  action={
                    <ActionButton
                      intent="quiet"
                      disabled={!canManage || !elevated}
                      onClick={recoverStart}
                    >
                      {t('workplace.experience.connectorRuntime.replay.recoverReceipt')}
                    </ActionButton>
                  }
                >
                  {t('workplace.experience.connectorRuntime.replay.commandUnknown')}
                </InlineFeedback>
              ) : (
                <ActionButton
                  intent="primary"
                  loading={startMutation.isPending}
                  disabled={!canStart}
                  onClick={submitStart}
                >
                  {t('workplace.experience.connectorRuntime.replay.start')}
                </ActionButton>
              )}
              {startMutation.isError &&
              isDefinitiveWorkplaceConnectorReplayFailure(startMutation.error) ? (
                <InlineFeedback severity="error">
                  {t('workplace.experience.connectorRuntime.replay.commandError')}
                </InlineFeedback>
              ) : null}
            </Stack>
          ) : null}
        </>
      )}
    </Stack>
  );
}

function ConnectorRuntimeDetail({
  connector,
  canManage,
  sourceReady,
  recoveryScope,
  refresh,
}: {
  connector: WorkplaceConnectorRuntimeTruth;
  canManage: boolean;
  sourceReady: boolean;
  recoveryScope: string | null;
  refresh: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation('rooms');
  return (
    <Stack spacing={1.5} data-testid={`workplace-connector-runtime-${connector.kind}`}>
      <Stack direction="row" gap={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="h6">
          {t(`workplace.experience.connectorKinds.${connector.kind}`)}
        </Typography>
        <Chip
          size="small"
          color={workplaceConnectorRuntimeTone(connector.state)}
          label={t(`workplace.experience.connectorRuntime.states.${connector.state}`)}
        />
      </Stack>
      {connector.state === 'CONFIGURED_UNVERIFIED' ? (
        <InlineFeedback severity="warning">
          {t('workplace.experience.connectorRuntime.unverifiedEvidence')}
        </InlineFeedback>
      ) : null}
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.25,
          m: 0,
        }}
      >
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.health')}
          value={
            connector.providerReportedState
              ? t(
                  `workplace.experience.connectorRuntime.providerStates.${connector.providerReportedState}`
                )
              : '—'
          }
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.freshness')}
          value={displayTime(connector.lastSuccessAt, i18n.language)}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.lag')}
          value={
            connector.lagSeconds === null
              ? '—'
              : t('workplace.experience.connectorRuntime.seconds', {
                  count: connector.lagSeconds,
                })
          }
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.cursor')}
          value={connector.checkpointReference ?? '—'}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.retryQueue')}
          value={connector.retryQueueDepth ?? '—'}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.deadLetterQueue')}
          value={connector.deadLetterQueueDepth ?? '—'}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.configurationVersion')}
          value={`${connector.observedConfigurationVersion ?? '—'} / ${connector.configurationVersion}`}
        />
        <RuntimeFact
          label={t('workplace.experience.connectorRuntime.evaluatedAt')}
          value={displayTime(connector.evaluatedAt, i18n.language)}
        />
      </Box>
      {connector.errorCode ? (
        <InlineFeedback severity="error">
          {t('workplace.experience.connectorRuntime.errorCode', { code: connector.errorCode })}
        </InlineFeedback>
      ) : null}
      <ConnectorReplayWorkflow
        key={`${recoveryScope ?? 'anonymous'}:${connector.kind}`}
        connector={connector}
        canManage={canManage}
        sourceReady={sourceReady}
        recoveryScope={recoveryScope}
        onCompleted={refresh}
      />
    </Stack>
  );
}

export function WorkplaceConnectorOperations({
  authorityKey,
  canManage,
  recoveryScope,
}: {
  authorityKey: string;
  canManage: boolean;
  recoveryScope: string | null;
}) {
  const { t, i18n } = useTranslation('rooms');
  const [selectedKind, setSelectedKind] = useState<WorkplaceConnectorKind | null>(null);
  const operationsQuery = useQuery({
    queryKey: ['workplace', 'connector-operations', authorityKey],
    queryFn: getWorkplaceConnectorOperations,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const operations = operationsQuery.data;
  useEffect(() => {
    if (!operations || selectedKind) return;
    const recovery = operations.connectors.find(
      (connector) => restoreWorkplaceConnectorReplayCommand(recoveryScope, connector.kind) !== null
    );
    const attention = operations.connectors.find((connector) => connector.state !== 'HEALTHY');
    setSelectedKind((recovery ?? attention ?? operations.connectors[0])?.kind ?? null);
  }, [operations, recoveryScope, selectedKind]);
  const selectedSummary = operations?.connectors.find(
    (connector) => connector.kind === selectedKind
  );
  const detailQuery = useQuery({
    queryKey: ['workplace', 'connector-operation', authorityKey, selectedKind],
    queryFn: () => getWorkplaceConnectorOperation(selectedKind!),
    enabled: Boolean(selectedKind),
    placeholderData: selectedSummary,
    staleTime: 10_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const summary = summarizeWorkplaceConnectorRuntime(operations?.connectors ?? []);
  const refresh = async () => {
    await Promise.all([operationsQuery.refetch(), detailQuery.refetch()]);
  };

  return (
    <GovernancePanel
      title={t('workplace.experience.connectorRuntime.title')}
      description={t('workplace.experience.connectorRuntime.description')}
      actions={
        <ActionButton
          intent="quiet"
          loading={operationsQuery.isFetching}
          startIcon={<RotateCcw size={16} />}
          onClick={() => void refresh()}
        >
          {t('actions.refresh')}
        </ActionButton>
      }
    >
      {operationsQuery.isLoading ? <GovernanceLoading rows={5} /> : null}
      {operationsQuery.isError ? (
        <Box sx={{ p: 1.5 }}>
          <InlineFeedback
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => void operationsQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('workplace.experience.connectorRuntime.loadError')}
          </InlineFeedback>
        </Box>
      ) : null}
      {operations ? (
        <Stack spacing={1.5} sx={{ p: 1.5, minWidth: 0 }}>
          <Stack direction="row" gap={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Activity size={17} aria-hidden="true" />
            {(['healthy', 'attention', 'replaying'] as const).map((key) => (
              <Chip
                key={key}
                size="small"
                variant="outlined"
                label={t(`workplace.experience.connectorRuntime.summary.${key}`, {
                  count: summary[key],
                })}
              />
            ))}
            <Typography variant="caption" color="text.secondary">
              {t('workplace.experience.connectorRuntime.generatedAt', {
                time: displayTime(operations.generatedAt, i18n.language),
              })}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(240px, .8fr) minmax(0, 1.4fr)' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <Stack component="nav" aria-label={t('workplace.experience.connectorRuntime.list')}>
              {operations.connectors.map((connector) => (
                <Box
                  component="button"
                  type="button"
                  key={connector.kind}
                  aria-pressed={selectedKind === connector.kind}
                  onClick={() => setSelectedKind(connector.kind)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.25,
                    border: 1,
                    borderColor: selectedKind === connector.kind ? 'primary.main' : 'divider',
                    bgcolor:
                      selectedKind === connector.kind ? 'action.selected' : 'background.paper',
                    color: 'text.primary',
                    textAlign: 'left',
                    cursor: 'pointer',
                    font: 'inherit',
                    '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light' },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                      {t(`workplace.experience.connectorKinds.${connector.kind}`)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {connector.provider ?? t('workplace.experience.notConnected')}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={workplaceConnectorRuntimeTone(connector.state)}
                    label={t(`workplace.experience.connectorRuntime.states.${connector.state}`)}
                  />
                </Box>
              ))}
            </Stack>
            <Box component="section" aria-live="polite" sx={{ minWidth: 0 }}>
              {detailQuery.isError ? (
                <InlineFeedback
                  severity="error"
                  action={
                    <ActionButton intent="quiet" onClick={() => void detailQuery.refetch()}>
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('workplace.experience.connectorRuntime.detailError')}
                </InlineFeedback>
              ) : null}
              {detailQuery.data ? (
                <ConnectorRuntimeDetail
                  connector={detailQuery.data}
                  canManage={canManage}
                  sourceReady={!detailQuery.isFetching && !detailQuery.isError}
                  recoveryScope={recoveryScope}
                  refresh={refresh}
                />
              ) : null}
            </Box>
          </Box>
        </Stack>
      ) : null}
    </GovernancePanel>
  );
}
