import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceClosureImpactPreview,
  createWorkplaceIdempotencyKey,
  executeWorkplaceClosureImpact,
  getWorkplaceClosureCommand,
  getWorkplaceClosureCommandReceipt,
  HttpError,
  reconcileWorkplaceClosureNotifications,
  resolveIdempotentMutationIntent,
  retryWorkplaceClosureNotifications,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { ActionButton, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { formatWorkplaceExperienceInstant } from './workplace-experience-format';

import type {
  IdempotentMutationIntent,
  WorkplaceClosureCommand,
  WorkplaceClosureCommandReceipt,
  WorkplaceClosureImpactAction,
  WorkplaceClosureImpactPreview,
  WorkplaceClosureImpactSelection,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

type SelectionDraft = Readonly<{
  action: WorkplaceClosureImpactAction | '';
  replacementResourceId: string;
}>;

type Props = Readonly<{
  resource: WorkplaceResource;
  range: Readonly<{ from: string; to: string }>;
  reason: string;
  canManage: boolean;
  sourceFresh: boolean;
  timeZone: string;
  onCompleted: () => void | Promise<void>;
}>;

const TERMINAL_STATES = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED', 'RESULT_UNKNOWN']);

function notificationSeverity(state: WorkplaceClosureCommand['notifications']['state']) {
  if (state === 'PUBLISHED' || state === 'NOT_REQUIRED') return 'success' as const;
  if (state === 'DEAD' || state === 'RESULT_UNKNOWN' || state === 'NOT_CONFIGURED') {
    return 'warning' as const;
  }
  return 'info' as const;
}

export function workplaceClosureSelections(
  preview: WorkplaceClosureImpactPreview,
  drafts: Readonly<Record<string, SelectionDraft>>
): readonly WorkplaceClosureImpactSelection[] | null {
  const result: WorkplaceClosureImpactSelection[] = [];
  for (const item of preview.items) {
    const draft = drafts[item.previewItemId];
    if (!draft?.action) return null;
    if (draft.action === 'REPLACE') {
      const candidate = item.replacementCandidates.find(
        (value) => value.workplaceResourceId === draft.replacementResourceId
      );
      if (!candidate) return null;
      result.push({
        previewItemId: item.previewItemId,
        action: draft.action,
        expectedBookingVersion: item.bookingVersion,
        replacementResourceId: candidate.workplaceResourceId,
        expectedReplacementResourceVersion: candidate.resourceVersion,
      });
    } else {
      result.push({
        previewItemId: item.previewItemId,
        action: draft.action,
        expectedBookingVersion: item.bookingVersion,
      });
    }
  }
  return result;
}

function stateColor(state: WorkplaceClosureCommand['state']) {
  if (state === 'SUCCEEDED') return 'success' as const;
  if (state === 'FAILED') return 'error' as const;
  if (state === 'PARTIAL' || state === 'RESULT_UNKNOWN') return 'warning' as const;
  return 'info' as const;
}

export function WorkplaceResourceClosureExecution({
  resource,
  range,
  reason,
  canManage,
  sourceFresh,
  timeZone,
  onCompleted,
}: Props) {
  const { t } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const authority = useProductSurfaceAuthority();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const [preview, setPreview] = useState<WorkplaceClosureImpactPreview | null>(null);
  const [drafts, setDrafts] = useState<Readonly<Record<string, SelectionDraft>>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [command, setCommand] = useState<WorkplaceClosureCommand | null>(null);
  const [receipt, setReceipt] = useState<WorkplaceClosureCommandReceipt | null>(null);
  const [recoveryReason, setRecoveryReason] = useState('');
  const [executionOutcome, setExecutionOutcome] = useState<
    'conflict' | 'denied' | 'unknown' | null
  >(null);
  const [previewClock, setPreviewClock] = useState(Date.now());
  const previewIntent = useRef<IdempotentMutationIntent | null>(null);
  const executeIntent = useRef<IdempotentMutationIntent | null>(null);
  const recoveryIntent = useRef<IdempotentMutationIntent | null>(null);
  const targetScope = `${resource.siteId}:${resource.resourceId}`;

  useEffect(() => {
    setPreview(null);
    setDrafts({});
    setConfirmed(false);
    setCommand(null);
    setReceipt(null);
    setRecoveryReason('');
    setExecutionOutcome(null);
    previewIntent.current = null;
    executeIntent.current = null;
    recoveryIntent.current = null;
  }, [targetScope]);
  useEffect(() => {
    if (!preview) return undefined;
    const remaining = Date.parse(preview.expiresAt) - Date.now();
    if (remaining <= 0) {
      setPreviewClock(Date.now());
      return undefined;
    }
    const timer = window.setTimeout(
      () => setPreviewClock(Date.now()),
      Math.min(remaining + 25, 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [preview]);

  const selections = useMemo(
    () => (preview ? workplaceClosureSelections(preview, drafts) : null),
    [drafts, preview]
  );
  const previewCurrent = Boolean(
    preview &&
    preview.siteId === resource.siteId &&
    preview.resourceId === resource.resourceId &&
    preview.resourceVersion === resource.version &&
    preview.startsAt === range.from &&
    preview.endsAt === range.to &&
    Date.parse(preview.expiresAt) > previewClock
  );

  const previewMutation = useMutation({
    retry: false,
    mutationFn: () => {
      if (!canManage || !sourceFresh) {
        throw new Error('Current closure management authority and source data are required.');
      }
      const input = {
        startsAt: range.from,
        endsAt: range.to,
        resourceVersion: resource.version,
      };
      const intent = resolveIdempotentMutationIntent(previewIntent.current, input, () =>
        createWorkplaceIdempotencyKey('facility-closure-impact-preview')
      );
      previewIntent.current = intent;
      return createWorkplaceClosureImpactPreview(
        resource.siteId,
        resource.resourceId,
        input,
        intent.key
      );
    },
    onSuccess: (value) => {
      setPreview(value);
      setDrafts(
        Object.fromEntries(
          value.items.map((item) => [item.previewItemId, { action: '', replacementResourceId: '' }])
        )
      );
      setConfirmed(false);
      setCommand(null);
      setReceipt(null);
      setExecutionOutcome(null);
      setPreviewClock(Date.now());
      executeIntent.current = null;
    },
  });

  const executeMutation = useMutation({
    retry: false,
    mutationFn: () => {
      if (
        !preview ||
        !previewCurrent ||
        Date.parse(preview.expiresAt) <= Date.now() ||
        !selections ||
        !canManage ||
        !sourceFresh ||
        !elevated ||
        !reason.trim() ||
        (!confirmed && executionOutcome !== 'unknown')
      ) {
        throw new Error('A current and complete closure-impact preview is required.');
      }
      const input = {
        expectedPreviewVersion: preview.previewVersion,
        confirmationToken: preview.confirmationToken,
        reason: reason.trim(),
        confirmed: true as const,
        selections,
      };
      const intent = resolveIdempotentMutationIntent(executeIntent.current, input, () =>
        createWorkplaceIdempotencyKey('facility-closure-execute')
      );
      executeIntent.current = intent;
      return executeWorkplaceClosureImpact(resource.siteId, preview.previewId, input, {
        idempotencyKey: intent.key,
        activeAccessMode: 'ELEVATED',
      });
    },
    onSuccess: async (value) => {
      setCommand(value);
      setConfirmed(false);
      setExecutionOutcome(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      await onCompleted();
    },
    onError: (error) => {
      setConfirmed(false);
      setExecutionOutcome(
        error instanceof HttpError && [401, 403, 404].includes(error.status)
          ? 'denied'
          : error instanceof HttpError && [400, 409, 410, 412].includes(error.status)
            ? 'conflict'
            : 'unknown'
      );
    },
  });

  const commandQuery = useQuery({
    queryKey: ['workplace', 'facility-closure-command', resource.siteId, command?.commandId],
    queryFn: () => getWorkplaceClosureCommand(resource.siteId, command!.commandId),
    enabled: Boolean(command && !TERMINAL_STATES.has(command.state)),
    retry: false,
    refetchInterval: command && !TERMINAL_STATES.has(command.state) ? 2_000 : false,
  });
  useEffect(() => {
    if (commandQuery.data) setCommand(commandQuery.data);
  }, [commandQuery.data]);

  const receiptQuery = useQuery({
    queryKey: ['workplace', 'facility-closure-receipt', resource.siteId, command?.commandId],
    queryFn: () => getWorkplaceClosureCommandReceipt(resource.siteId, command!.commandId),
    enabled: Boolean(command && TERMINAL_STATES.has(command.state)),
    retry: false,
  });
  useEffect(() => {
    if (receiptQuery.data) setReceipt(receiptQuery.data);
  }, [receiptQuery.data]);

  const refreshMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!command) throw new Error('A closure command receipt is required.');
      const value = await getWorkplaceClosureCommand(resource.siteId, command.commandId);
      const nextReceipt = TERMINAL_STATES.has(value.state)
        ? await getWorkplaceClosureCommandReceipt(resource.siteId, command.commandId)
        : null;
      return { value, nextReceipt };
    },
    onSuccess: async ({ value, nextReceipt }) => {
      setCommand(value);
      if (nextReceipt) setReceipt(nextReceipt);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
    },
  });

  const recoveryMutation = useMutation({
    retry: false,
    mutationFn: (operation: 'reconcile' | 'retry') => {
      if (!command || !canManage || !elevated || !recoveryReason.trim()) {
        throw new Error('Current elevated authority and a recovery reason are required.');
      }
      const input = {
        expectedCommandVersion: command.version,
        reason: recoveryReason.trim(),
        confirmed: true as const,
      };
      const fingerprint = { operation, commandId: command.commandId, ...input };
      const intent = resolveIdempotentMutationIntent(recoveryIntent.current, fingerprint, () =>
        createWorkplaceIdempotencyKey(`facility-closure-notification-${operation}`)
      );
      recoveryIntent.current = intent;
      const options = { idempotencyKey: intent.key, activeAccessMode: 'ELEVATED' as const };
      return operation === 'retry'
        ? retryWorkplaceClosureNotifications(resource.siteId, command.commandId, input, options)
        : reconcileWorkplaceClosureNotifications(
            resource.siteId,
            command.commandId,
            input,
            options
          );
    },
    onSuccess: async (value) => {
      setCommand(value);
      setRecoveryReason('');
      recoveryIntent.current = null;
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'facility-closure-receipt', resource.siteId, value.commandId],
      });
    },
  });

  const executeReady =
    canManage &&
    sourceFresh &&
    elevated &&
    previewCurrent &&
    Boolean(selections) &&
    Boolean(reason.trim()) &&
    confirmed &&
    !executeMutation.isPending &&
    !executionOutcome;
  const recoveryReady =
    Boolean(command) &&
    elevated &&
    canManage &&
    Boolean(recoveryReason.trim()) &&
    !recoveryMutation.isPending;

  if (command) {
    const notifications = command.notifications;
    const canReconcile =
      notifications.reconciliationRequired || notifications.state === 'RESULT_UNKNOWN';
    const canRetry = notifications.state === 'DEAD';
    return (
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack gap={1.5}>
          <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
            <Box>
              <Typography component="h3" variant="subtitle1" fontWeight={750}>
                {t('workplace.experience.closureExecution.receiptTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.experience.closureExecution.commandId')} · {command.commandId}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={stateColor(command.state)}
              label={t(`workplace.experience.closureExecution.commandStates.${command.state}`)}
            />
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            {(['keptCount', 'cancelledCount', 'replacedCount'] as const).map((key) => (
              <Box key={key} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t(`workplace.experience.closureExecution.${key}`)}
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {command[key]}
                </Typography>
              </Box>
            ))}
            <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.experience.closureExecution.recipients')}
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {notifications.recipientCount}
              </Typography>
            </Box>
          </Box>
          <Alert severity={notificationSeverity(notifications.state)}>
            {t(`workplace.experience.closureExecution.notificationStates.${notifications.state}`, {
              published: notifications.publishedCount,
              total: notifications.eventCount,
            })}
          </Alert>
          {command.items.map((item) => (
            <Stack
              key={item.commandItemId}
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              gap={0.5}
              sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography variant="body2">
                {item.bookingId} ·{' '}
                {t(`workplace.experience.closureExecution.actions.${item.selectedAction}`)}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={t(`workplace.experience.closureExecution.itemStates.${item.resultState}`)}
              />
            </Stack>
          ))}
          {receipt ? (
            <InlineFeedback severity={receipt.externalDeliveryProven ? 'success' : 'info'}>
              {t('workplace.experience.closureExecution.auditEvidence', {
                count: receipt.auditTrail.length,
              })}
            </InlineFeedback>
          ) : null}
          {canReconcile || canRetry ? (
            <Stack gap={1}>
              <TextField
                label={t('workplace.experience.closureExecution.recoveryReason')}
                value={recoveryReason}
                onChange={(event) => setRecoveryReason(event.target.value)}
                inputProps={{ maxLength: 500 }}
                multiline
                minRows={2}
              />
              {!elevated ? (
                <InlineFeedback severity="warning">
                  {t('workplace.experience.closureExecution.elevationRequired')}
                </InlineFeedback>
              ) : null}
              <Stack direction="row" gap={1} flexWrap="wrap">
                {canReconcile ? (
                  <ActionButton
                    intent="secondary"
                    disabled={!recoveryReady}
                    onClick={() => recoveryMutation.mutate('reconcile')}
                  >
                    {t('workplace.experience.closureExecution.reconcile')}
                  </ActionButton>
                ) : null}
                {canRetry ? (
                  <ActionButton
                    intent="secondary"
                    disabled={!recoveryReady}
                    onClick={() => recoveryMutation.mutate('retry')}
                  >
                    {t('workplace.experience.closureExecution.retryNotification')}
                  </ActionButton>
                ) : null}
              </Stack>
            </Stack>
          ) : null}
          {recoveryMutation.isError ||
          commandQuery.isError ||
          receiptQuery.isError ||
          refreshMutation.isError ? (
            <InlineFeedback severity="error">
              {t('workplace.experience.closureExecution.recoveryError')}
            </InlineFeedback>
          ) : null}
          <Stack direction="row" gap={1} flexWrap="wrap">
            <ActionButton
              intent="quiet"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            >
              {t('workplace.experience.closureExecution.refreshStatus')}
            </ActionButton>
            {TERMINAL_STATES.has(command.state) ? (
              <ActionButton
                intent="quiet"
                onClick={() => {
                  setCommand(null);
                  setReceipt(null);
                  setPreview(null);
                  setDrafts({});
                  executeIntent.current = null;
                }}
              >
                {t('workplace.experience.closureExecution.newClosure')}
              </ActionButton>
            ) : null}
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Stack gap={1.5}>
        <Box>
          <Typography component="h3" variant="subtitle1" fontWeight={750}>
            {t('workplace.experience.closureExecution.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.experience.closureExecution.description')}
          </Typography>
        </Box>
        {!preview ? (
          <ActionButton
            intent="secondary"
            disabled={!canManage || !sourceFresh || previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            {t('workplace.experience.closureExecution.preview')}
          </ActionButton>
        ) : null}
        {previewMutation.isError ? (
          <InlineFeedback severity="error">
            {t('workplace.experience.closureExecution.previewError')}
          </InlineFeedback>
        ) : null}
        {preview && previewCurrent ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 1,
              }}
            >
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('workplace.experience.closureExecution.affectedBookings')}
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {preview.affectedBookingCount}
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('workplace.experience.closureExecution.recipients')}
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {preview.affectedRecipientCount}
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('workplace.experience.closureExecution.previewExpires')}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {formatWorkplaceExperienceInstant(preview.expiresAt, timeZone)}
                </Typography>
              </Box>
            </Box>
            {!preview.items.length ? (
              <InlineFeedback severity="info">
                {t('workplace.experience.closureExecution.noAffectedBookings')}
              </InlineFeedback>
            ) : null}
            {preview.items.map((item) => {
              const draft = drafts[item.previewItemId] ?? {
                action: '',
                replacementResourceId: '',
              };
              return (
                <Box
                  key={item.previewItemId}
                  sx={{
                    p: { xs: 1.25, sm: 1.5 },
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Stack gap={1}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      gap={0.5}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {formatWorkplaceExperienceInstant(item.startsAt, timeZone)} –{' '}
                          {formatWorkplaceExperienceInstant(item.endsAt, timeZone)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.reservationOwner} · {item.bookingStatus} ·{' '}
                          {item.recipientUserIds.length}{' '}
                          {t('workplace.experience.closureExecution.recipients')}
                        </Typography>
                      </Box>
                      <Chip size="small" variant="outlined" label={item.bookingId} />
                    </Stack>
                    <SelectField<WorkplaceClosureImpactAction>
                      label={t('workplace.experience.closureExecution.bookingAction')}
                      value={draft.action}
                      placeholder={t('workplace.experience.closureExecution.selectAction')}
                      options={(['KEEP', 'CANCEL', 'REPLACE'] as const).map((action) => ({
                        value: action,
                        label: t(`workplace.experience.closureExecution.actions.${action}`),
                        disabled: action === 'REPLACE' && !item.replacementCandidates.length,
                      }))}
                      onValueChange={(action) => {
                        setDrafts((current) => ({
                          ...current,
                          [item.previewItemId]: {
                            action,
                            replacementResourceId:
                              action === 'REPLACE' ? draft.replacementResourceId : '',
                          },
                        }));
                        setConfirmed(false);
                        setExecutionOutcome(null);
                        executeIntent.current = null;
                      }}
                    />
                    {draft.action === 'REPLACE' ? (
                      <SelectField
                        label={t('workplace.experience.closureExecution.replacementSpace')}
                        value={draft.replacementResourceId}
                        placeholder={t('workplace.experience.closureExecution.selectReplacement')}
                        options={item.replacementCandidates.map((candidate) => ({
                          value: candidate.workplaceResourceId,
                          label: `${candidate.resourceName} · #${candidate.rank + 1}`,
                        }))}
                        onValueChange={(replacementResourceId) => {
                          setDrafts((current) => ({
                            ...current,
                            [item.previewItemId]: { ...draft, replacementResourceId },
                          }));
                          setConfirmed(false);
                          setExecutionOutcome(null);
                          executeIntent.current = null;
                        }}
                      />
                    ) : null}
                    {draft.action === 'REPLACE' && item.replacementBlockReason ? (
                      <InlineFeedback severity="warning">
                        {item.replacementBlockReason}
                      </InlineFeedback>
                    ) : null}
                  </Stack>
                </Box>
              );
            })}
            <Divider />
            {!elevated ? (
              <InlineFeedback severity="warning">
                {t('workplace.experience.closureExecution.elevationRequired')}
              </InlineFeedback>
            ) : null}
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  disabled={
                    !canManage || !sourceFresh || !previewCurrent || !selections || !reason.trim()
                  }
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              }
              label={t('workplace.experience.closureExecution.confirm')}
            />
            <Stack direction="row" gap={1} flexWrap="wrap">
              <ActionButton
                intent="danger"
                disabled={!executeReady}
                onClick={() => executeMutation.mutate()}
              >
                {t('workplace.experience.closureExecution.execute')}
              </ActionButton>
              <ActionButton
                intent="quiet"
                disabled={executeMutation.isPending}
                onClick={() => {
                  setPreview(null);
                  setDrafts({});
                  setConfirmed(false);
                  previewIntent.current = null;
                  executeIntent.current = null;
                  setExecutionOutcome(null);
                }}
              >
                {t('workplace.experience.closureExecution.discardPreview')}
              </ActionButton>
            </Stack>
          </>
        ) : preview ? (
          <InlineFeedback severity="warning">
            {t('workplace.experience.closureExecution.previewExpired')}
          </InlineFeedback>
        ) : null}
        {executionOutcome ? (
          <InlineFeedback
            severity="error"
            action={
              executionOutcome === 'unknown' ? (
                <ActionButton
                  intent="secondary"
                  disabled={!elevated || !canManage || executeMutation.isPending}
                  onClick={() => executeMutation.mutate()}
                >
                  {t('workplace.experience.closureExecution.retrySameCommand')}
                </ActionButton>
              ) : undefined
            }
          >
            {t(
              `workplace.experience.closureExecution.${
                executionOutcome === 'denied'
                  ? 'executionDenied'
                  : executionOutcome === 'conflict'
                    ? 'executionConflict'
                    : 'executionUnknown'
              }`
            )}
          </InlineFeedback>
        ) : null}
      </Stack>
    </Paper>
  );
}
