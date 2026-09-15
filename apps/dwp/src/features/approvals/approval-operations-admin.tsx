import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Activity, ArrowLeft, CloudCog, RefreshCcw, RotateCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
  SignalMetric,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getApprovalOperations,
  retryApprovalIntegrationDelivery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { approvalDeliveryRetryCommand } from './approval-high-risk-command-model';
import { focusApprovalRegion, focusApprovalSelector } from './approval-focus-navigation';
import { useApprovalManagementHighRiskCommand } from './approval-management-command-scope';
import { summarizeApprovalOperations } from './approval-management-model';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import {
  approvalNativeOperationSnapshotCurrent,
  createApprovalDeliveryOperationProposal,
  createApprovalTaskReassignmentProposal,
  toggleApprovalOperationSelection,
} from './approval-native-operations-model';
import {
  ApprovalNativeOperationDialog,
  type ApprovalNativeDialogAction,
} from './approval-native-operation-dialog';
import { ApprovalNativeOperationCommand } from './use-approval-native-operation-command';
import {
  ApprovalOperationsDeliveryInspector,
  ApprovalOperationsDeliveryPane,
} from './approval-operations-delivery-pane';
import {
  ApprovalOperationsTaskInspector,
  ApprovalOperationsTaskPane,
} from './approval-operations-task-pane';
import { ApprovalRetentionWorkspace } from './approval-retention-workspace';
import { ApprovalSurface, StatusChip } from './approval-ui';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import {
  approvalOperationsDeliveryQueue,
  approvalOperationsQueueFromSearch,
  approvalOperationsRetrySnapshotCurrent,
  approvalOperationsSourceCurrent,
  parseApprovalOperationsProjection,
} from './approval-operations-workbench-model';

import type {
  ApprovalDelegationCandidate,
  ApprovalIntegrationDelivery,
  ApprovalOperations,
  ApprovalTask,
} from '@dwp-frontend/shared-utils';
import type { ApprovalNativeDeliveryAction } from '@dwp-frontend/shared-utils/api/approval-native-operations-api';
import type { ApprovalNativeOperationProposal } from './approval-native-operations-model';
import type {
  ApprovalOperationsQueue,
  ApprovalOperationsProjection,
  ApprovalOperationsSort,
  ApprovalOperationsStatus,
} from './approval-operations-workbench-model';

type NativeDialog =
  | Readonly<{
      action: ApprovalNativeDeliveryAction;
      deliveries: readonly ApprovalIntegrationDelivery[];
    }>
  | Readonly<{
      action: 'TASK_REASSIGN';
      tasks: readonly ApprovalTask[];
    }>;

export function ApprovalOperationsAdmin() {
  return (
    <Stack gap={2}>
      <ApprovalOperationsWorkbench />
      <ApprovalRetentionWorkspace />
    </Stack>
  );
}

function ApprovalOperationsWorkbench() {
  const { t, i18n } = useTranslation('approvals');
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('lg'));
  const queryClient = useQueryClient();
  const { canOperate } = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectedIdsRef = useRef<ReadonlySet<string>>(selectedIds);
  const [nativeDialog, setNativeDialog] = useState<NativeDialog | null>(null);
  const [nativeProposal, setNativeProposal] = useState<ApprovalNativeOperationProposal | null>(
    null
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const queue = approvalOperationsQueueFromSearch(searchParams);
  const setQueue = useCallback(
    (value: ApprovalOperationsQueue) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('queue', value);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const [status, setStatus] = useState<ApprovalOperationsStatus>('ALL');
  const [sort, setSort] = useState<ApprovalOperationsSort>('OLDEST');
  const [, expireSource] = useState(0);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const queueRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const focusInspector = useRef(false);
  const operationsQueryKey = [
    'approvals',
    'admin',
    'operations',
    ...requestScope.cacheKey,
  ] as const;
  const operations = useQuery({
    queryKey: operationsQueryKey,
    queryFn: ({ signal }) => getApprovalOperations(requestScope.contextScopeKey, signal),
    enabled: scopeReady,
    refetchInterval: 30_000,
    retry: false,
    notifyOnChangeProps: 'all',
  });
  const projection = useMemo(() => {
    if (!operations.data) return null;
    try {
      return parseApprovalOperationsProjection(operations.data);
    } catch {
      return null;
    }
  }, [operations.data]);
  const projectionInvalid = operations.isSuccess && projection === null;
  const fullOperations = projection?.kind === 'full' ? projection.data : null;
  const summary = summarizeApprovalOperations(projection ?? undefined);
  const scopeFingerprint = JSON.stringify(requestScope.cacheKey);

  useEffect(() => {
    const expiresAt = Date.parse(projection?.data.generatedAt ?? '') + 45_000;
    if (!Number.isFinite(expiresAt)) return;
    const timer = window.setTimeout(
      () => expireSource((value) => value + 1),
      Math.max(1, expiresAt - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [projection?.data.generatedAt]);

  const deliveries = useMemo(
    () =>
      approvalOperationsDeliveryQueue(
        fullOperations?.integrationDeliveries ?? [],
        queue,
        status,
        sort
      ),
    [fullOperations?.integrationDeliveries, queue, status, sort]
  );
  const tasks = useMemo(() => fullOperations?.breachedTasks ?? [], [fullOperations?.breachedTasks]);
  const selectedTask = tasks.find((task) => task.taskId === selectedId) ?? null;
  const selectedDelivery = deliveries.find((delivery) => delivery.outboxId === selectedId) ?? null;

  useEffect(() => {
    const ids =
      queue === 'sla' ? tasks.map((task) => task.taskId) : deliveries.map((item) => item.outboxId);
    if (ids.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!ids.includes(selectedId ?? '')) setSelectedId(ids[0]!);
  }, [deliveries, queue, selectedId, tasks]);

  const selectForInspection = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (compact) {
        focusInspector.current = true;
        setMobileInspectorOpen(true);
      }
    },
    [compact]
  );
  useEffect(() => {
    if (!compact || !focusInspector.current || (!selectedTask && !selectedDelivery)) return;
    focusInspector.current = false;
    const frame = window.requestAnimationFrame(() => {
      focusApprovalRegion(inspectorRef.current, 'start');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compact, selectedDelivery, selectedTask]);

  const backToSelectedOperation = () => {
    focusInspector.current = false;
    setMobileInspectorOpen(false);
    window.requestAnimationFrame(() => {
      focusApprovalSelector(queueRef.current, '[aria-current="true"]', 'center');
    });
  };

  const replaceSelection = useCallback((ids: readonly string[]) => {
    const next = new Set(ids.slice(0, 50));
    selectedIdsRef.current = next;
    setSelectedIds(next);
  }, []);
  const toggleSelection = useCallback((targetId: string, checked: boolean) => {
    const next = toggleApprovalOperationSelection(selectedIdsRef.current, targetId, checked);
    selectedIdsRef.current = next;
    setSelectedIds(next);
  }, []);

  const retryOriginal = useRef<Parameters<typeof approvalOperationsRetrySnapshotCurrent>[1]>(null);
  const latestRetryScope = useRef({ selectedId, scopeFingerprint, canOperate: false });
  latestRetryScope.current = {
    selectedId,
    scopeFingerprint,
    canOperate: scopeReady && canOperate && queue === 'delivery' && !nativeProposal,
  };
  const assertRetryCurrent = () => {
    if (
      !approvalOperationsRetrySnapshotCurrent(
        queryClient.getQueryState<ApprovalOperations>(operationsQueryKey),
        retryOriginal.current,
        latestRetryScope.current
      )
    ) {
      throw new Error('Approval recovery source changed');
    }
  };
  const highRiskRetry = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'DELIVERY_RETRY',
    execute: (command, execution) => {
      assertRetryCurrent();
      if (
        retryOriginal.current?.outboxId !== command.targetId ||
        retryOriginal.current.expectedVersion !== command.expectedObjectVersion
      ) {
        throw new Error('Approval recovery command changed');
      }
      return retryApprovalIntegrationDelivery(
        command.targetId,
        command.expectedObjectVersion,
        execution,
        { beforeDispatch: assertRetryCurrent }
      );
    },
    onSuccess: (data) => {
      retryOriginal.current = null;
      queryClient.setQueryData(operationsQueryKey, data);
    },
    onConflict: async () => {
      await queryClient.invalidateQueries({ queryKey: operationsQueryKey, exact: true });
    },
  });
  const { close: closeHighRiskRetry } = highRiskRetry.controller;

  const resetInteraction = useCallback(() => {
    setSelectedId(null);
    replaceSelection([]);
    setNativeDialog(null);
    setNativeProposal(null);
    setMobileInspectorOpen(false);
    focusInspector.current = false;
    retryOriginal.current = null;
    closeHighRiskRetry();
  }, [closeHighRiskRetry, replaceSelection]);
  const previousQueue = useRef(queue);
  useEffect(() => {
    if (previousQueue.current === queue) return;
    previousQueue.current = queue;
    resetInteraction();
  }, [queue, resetInteraction]);
  const resetScopeState = useCallback(() => {
    resetInteraction();
    setQueue('delivery');
    setStatus('ALL');
    setSort('OLDEST');
  }, [resetInteraction, setQueue]);
  useApprovalManagementScopeReset(requestScope.cacheKey, resetScopeState);

  const operationWriteReady =
    scopeReady &&
    operations.isSuccess &&
    !operations.isFetching &&
    operations.failureCount === 0 &&
    approvalOperationsSourceCurrent(
      queryClient.getQueryState<ApprovalOperations>(operationsQueryKey)
    ) &&
    projection?.kind === 'full' &&
    canOperate &&
    !nativeProposal;
  const formatTimestamp = (value?: string | null) =>
    value
      ? formatDate(
          value,
          { dateStyle: 'short', timeStyle: 'short' },
          resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
        )
      : t('admin.integrations.notAvailable');

  const openDeliveryCommand = (
    action: ApprovalNativeDeliveryAction,
    targets: readonly ApprovalIntegrationDelivery[]
  ) => {
    if (!operationWriteReady || targets.length === 0) return;
    replaceSelection(targets.map((target) => target.outboxId));
    setNativeDialog({ action, deliveries: targets.map((target) => structuredClone(target)) });
  };
  const openTaskCommand = (targets: readonly ApprovalTask[]) => {
    if (!operationWriteReady || targets.length === 0) return;
    replaceSelection(targets.map((target) => target.taskId));
    setNativeDialog({
      action: 'TASK_REASSIGN',
      tasks: targets.map((target) => structuredClone(target)),
    });
  };
  const submitNativeCommand = (reason: string, candidate: ApprovalDelegationCandidate | null) => {
    if (!nativeDialog || !fullOperations || !operationWriteReady) return;
    const proposal =
      nativeDialog.action === 'TASK_REASSIGN'
        ? candidate
          ? createApprovalTaskReassignmentProposal({
              targets: nativeDialog.tasks,
              candidate,
              reason,
              generatedAt: fullOperations.generatedAt,
              scopeFingerprint,
            })
          : null
        : createApprovalDeliveryOperationProposal({
            action: nativeDialog.action,
            targets: nativeDialog.deliveries,
            reason,
            generatedAt: fullOperations.generatedAt,
            scopeFingerprint,
          });
    if (
      !proposal ||
      !approvalNativeOperationSnapshotCurrent(
        queryClient.getQueryState<ApprovalOperations>(operationsQueryKey),
        proposal,
        { selectedIds: selectedIdsRef.current, scopeFingerprint, canOperate: operationWriteReady }
      )
    ) {
      void operations.refetch();
      return;
    }
    setNativeDialog(null);
    setNativeProposal(proposal);
  };
  const assertNativeCurrent = () => {
    if (
      !nativeProposal ||
      !approvalNativeOperationSnapshotCurrent(
        queryClient.getQueryState<ApprovalOperations>(operationsQueryKey),
        nativeProposal,
        {
          selectedIds: selectedIdsRef.current,
          scopeFingerprint: JSON.stringify(requestScope.cacheKey),
          canOperate: scopeReady && canOperate,
        }
      )
    ) {
      throw new Error('Approval native operation source changed');
    }
  };
  const nativeProposalCurrent =
    !nativeProposal ||
    approvalNativeOperationSnapshotCurrent(
      queryClient.getQueryState<ApprovalOperations>(operationsQueryKey),
      nativeProposal,
      {
        selectedIds,
        scopeFingerprint,
        canOperate: scopeReady && canOperate,
      }
    );

  useEffect(() => {
    if (nativeProposal && !nativeProposalCurrent) setNativeProposal(null);
  }, [nativeProposal, nativeProposalCurrent]);

  if (!scopeReady) {
    return (
      <ErrorState
        title={t('admin.loadError')}
        description={t('pages.operations.description')}
        size="compact"
      />
    );
  }
  if (operations.isPending) {
    return (
      <LoadingState
        label={t('pages.operations.title')}
        description={t('pages.operations.description')}
        variant="skeleton"
        skeletonRows={5}
        size="compact"
      />
    );
  }
  if (operations.isError || projectionInvalid || !projection) {
    return (
      <ErrorState
        title={t('admin.loadError')}
        retryLabel={t('actions.retry')}
        retrying={operations.isFetching}
        onRetry={() => void operations.refetch()}
        size="compact"
      />
    );
  }
  if (projection.kind !== 'full') {
    return (
      <ApprovalRestrictedOperations
        projection={projection}
        korean={korean}
        refreshing={operations.isFetching}
        formatTimestamp={formatTimestamp}
        onRefresh={() => void operations.refetch()}
      />
    );
  }

  return (
    <Stack gap={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Box
          component="span"
          sx={{ typography: 'caption', color: 'text.secondary' }}
          aria-live="polite"
        >
          {`${t('admin.metricDetail')} · ${formatTimestamp(projection.data.generatedAt)}`}
        </Box>
        <ActionIconButton
          label={t('actions.refresh')}
          size="small"
          loading={operations.isFetching}
          onClick={() => void operations.refetch()}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2,minmax(0,1fr))',
            lg: 'repeat(5,minmax(0,1fr))',
          },
          gap: 1.25,
        }}
      >
        {projection.data.signals.map((signal) => (
          <SignalMetric
            key={signal.key}
            label={korean ? signal.titleKo : signal.titleEn}
            value={String(signal.count)}
            detail={korean ? signal.detailKo : signal.detailEn}
            icon={signal.key === 'integration' ? <CloudCog size={17} /> : <Activity size={17} />}
            tone={
              signal.state === 'HEALTHY'
                ? 'success'
                : signal.state === 'INFORMATIONAL'
                  ? 'info'
                  : 'warning'
            }
          />
        ))}
        <SignalMetric
          label={t('admin.operationsQueue.retryReady')}
          value={
            operationWriteReady
              ? String(summary.retryCandidates ?? 0)
              : t('admin.integrations.notAvailable')
          }
          detail={
            operationWriteReady
              ? t('admin.operationsQueue.loadedOnly')
              : t('admin.operationsQueue.sourceStale')
          }
          icon={<RotateCcw size={17} />}
          tone="info"
        />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,5fr) minmax(0,7fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box ref={queueRef} minWidth={0}>
          <ApprovalSurface
            title={t('admin.integrations.title')}
            meta={t('admin.integrations.meta')}
            action={
              <Chip
                size="small"
                variant="outlined"
                label={t('admin.integrations.eventCount', { count: summary.totalDeliveries })}
              />
            }
          >
          <Tabs
            value={queue}
            onChange={(_, value: ApprovalOperationsQueue) => setQueue(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={t('admin.operationsQueue.title')}
          >
            {(['sla', 'delivery', 'resolved'] as const).map((value) => (
              <Tab
                key={value}
                value={value}
                disabled={Boolean(nativeProposal)}
                id={`approval-operations-${value}-tab`}
                aria-controls={`approval-operations-${value}-panel`}
                label={t(`admin.operationsQueue.${value}`)}
              />
            ))}
          </Tabs>
          <Box
            sx={{
              p: 1.5,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 1,
            }}
          >
            <SelectField
              size="small"
              label={t('admin.integrations.columns.status')}
              value={status}
              disabled={queue !== 'delivery' || Boolean(nativeProposal)}
              options={(['ALL', 'PENDING', 'SENDING', 'FAILED', 'DEAD'] as const).map((value) => ({
                value,
                label:
                  value === 'ALL' ? t('admin.operationsQueue.allStatuses') : t(`status.${value}`),
              }))}
              onValueChange={(value) => value && setStatus(value)}
            />
            <SelectField
              size="small"
              label={t('admin.operationsQueue.sort')}
              value={sort}
              disabled={queue === 'sla' || Boolean(nativeProposal)}
              options={(['OLDEST', 'NEWEST', 'AVAILABLE'] as const).map((value) => ({
                value,
                label: t(`admin.operationsQueue.sorts.${value}`),
              }))}
              onValueChange={(value) => value && setSort(value)}
            />
          </Box>
          <Box
            role="tabpanel"
            id={`approval-operations-${queue}-panel`}
            aria-labelledby={`approval-operations-${queue}-tab`}
            tabIndex={0}
          >
            {queue === 'sla' ? (
              <ApprovalOperationsTaskPane
                tasks={tasks}
                selected={selectedTask}
                selectedIds={selectedIds}
                canOperate={operationWriteReady}
                busy={Boolean(nativeProposal)}
                onSelect={(task) => selectForInspection(task.taskId)}
                onToggle={toggleSelection}
                onToggleVisible={(targets, checked) =>
                  replaceSelection(checked ? targets.map((target) => target.taskId) : [])
                }
                onReassign={openTaskCommand}
              />
            ) : (
              <ApprovalOperationsDeliveryPane
                deliveries={deliveries}
                selected={selectedDelivery}
                selectedIds={selectedIds}
                canOperate={operationWriteReady && queue === 'delivery'}
                busy={Boolean(nativeProposal)}
                formatTimestamp={formatTimestamp}
                onSelect={(delivery) => selectForInspection(delivery.outboxId)}
                onToggle={toggleSelection}
                onToggleVisible={(targets, checked) =>
                  replaceSelection(checked ? targets.map((target) => target.outboxId) : [])
                }
                onNative={openDeliveryCommand}
              />
            )}
          </Box>
          </ApprovalSurface>
        </Box>
        <Box
          ref={inspectorRef}
          role="region"
          aria-label={t('admin.studio.processInspector')}
          tabIndex={-1}
          sx={{ minWidth: 0, scrollMarginBlockStart: 16 }}
        >
          {compact && mobileInspectorOpen ? (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={backToSelectedOperation}
              sx={{ mb: 1 }}
            >
              {t('home.commandCenter.backToQueue')}
            </ActionButton>
          ) : null}
          {queue === 'sla' && selectedTask ? (
            <ApprovalOperationsTaskInspector
              task={selectedTask}
              canOperate={operationWriteReady}
              busy={Boolean(nativeProposal)}
              formatTimestamp={formatTimestamp}
              onReassign={openTaskCommand}
            />
          ) : selectedDelivery ? (
            <ApprovalOperationsDeliveryInspector
              delivery={selectedDelivery}
              canOperate={operationWriteReady && queue === 'delivery'}
              busy={highRiskRetry.controller.busy || Boolean(nativeProposal)}
              formatTimestamp={formatTimestamp}
              onRetry={(expectedVersion) => {
                if (!operationWriteReady || queue !== 'delivery') return;
                retryOriginal.current = {
                  outboxId: selectedDelivery.outboxId,
                  expectedVersion,
                  deliveryFingerprint: JSON.stringify(selectedDelivery),
                  scopeFingerprint,
                };
                assertRetryCurrent();
                void highRiskRetry.begin(
                  approvalDeliveryRetryCommand(selectedDelivery.outboxId, expectedVersion)
                );
              }}
              onNative={openDeliveryCommand}
            />
          ) : (
            <EmptyState
              title={t('admin.integrations.empty')}
              description={t('admin.integrations.meta')}
              icon={<CloudCog size={24} />}
            />
          )}
        </Box>
      </Box>
      <ApprovalHighRiskCommandDialog controller={highRiskRetry.controller} />
      <ApprovalNativeOperationDialog
        open={Boolean(nativeDialog)}
        action={(nativeDialog?.action ?? 'RETRY') as ApprovalNativeDialogAction}
        count={
          nativeDialog
            ? 'tasks' in nativeDialog
              ? nativeDialog.tasks.length
              : nativeDialog.deliveries.length
            : 0
        }
        busy={false}
        sourceReady={operationWriteReady}
        requestScope={requestScope}
        onClose={() => setNativeDialog(null)}
        onSubmit={submitNativeCommand}
      />
      {nativeProposal ? (
        <ApprovalNativeOperationCommand
          key={`${nativeProposal.operation}:${nativeProposal.selectionFingerprint}`}
          proposal={nativeProposal}
          cacheKey={operationsQueryKey}
          assertCurrent={assertNativeCurrent}
          onCommitted={() => {
            setNativeProposal(null);
            replaceSelection([]);
          }}
          onDismiss={() => setNativeProposal(null)}
        />
      ) : null}
    </Stack>
  );
}

function ApprovalRestrictedOperations({
  projection,
  korean,
  refreshing,
  formatTimestamp,
  onRefresh,
}: {
  projection: Exclude<ApprovalOperationsProjection, { kind: 'full' }>;
  korean: boolean;
  refreshing: boolean;
  formatTimestamp: (value?: string | null) => string;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Stack gap={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
          {`${t('admin.metricDetail')} · ${formatTimestamp(projection.data.generatedAt)}`}
        </Box>
        <ActionIconButton
          label={t('actions.refresh')}
          size="small"
          loading={refreshing}
          onClick={onRefresh}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>
      <InlineFeedback severity="info">{t('admin.studio.readOnly')}</InlineFeedback>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' },
          gap: 1.25,
        }}
      >
        {projection.data.signals.map((signal) => (
          <SignalMetric
            key={signal.key}
            label={'titleKo' in signal ? (korean ? signal.titleKo : signal.titleEn) : signal.key}
            value={String(signal.count)}
            detail={signal.state}
            icon={signal.key === 'integration' ? <CloudCog size={17} /> : <Activity size={17} />}
            tone={
              signal.state === 'HEALTHY'
                ? 'success'
                : signal.state === 'INFORMATIONAL'
                  ? 'info'
                  : 'warning'
            }
          />
        ))}
      </Box>
      <ApprovalSurface
        title={t('admin.integrations.title')}
        meta={t('admin.integrations.meta')}
        action={
          <Chip
            size="small"
            variant="outlined"
            label={t('admin.integrations.eventCount', {
              count: projection.data.integrationDeliveries.length,
            })}
          />
        }
      >
        {projection.data.integrationDeliveries.length === 0 ? (
          <EmptyState
            title={t('admin.integrations.empty')}
            description={t('admin.integrations.meta')}
            icon={<CloudCog size={24} />}
          />
        ) : (
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {projection.data.integrationDeliveries.map((delivery, index) => (
              <Stack
                component="li"
                key={`${delivery.eventType}:${delivery.availableAt}:${index}`}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                gap={1}
                sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box minWidth={0}>
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      typography: 'body2',
                      fontWeight: 700,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {delivery.eventType}
                  </Box>
                  <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {`${t('admin.integrations.availableAt')} · ${formatTimestamp(delivery.availableAt)}`}
                  </Box>
                </Box>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <StatusChip status={delivery.status} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('admin.nativeOperations.attempts.automatic', {
                      count: delivery.attemptCount,
                    })}
                  />
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </ApprovalSurface>
    </Stack>
  );
}
