import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Activity, CloudCog, RefreshCcw, RotateCcw, TriangleAlert } from 'lucide-react';
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
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { alpha } from '@mui/material/styles';

import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { ApprovalRetentionWorkspace } from './approval-retention-workspace';
import { approvalDeliveryRetryCommand } from './approval-high-risk-command-model';
import {
  approvalDeliveryRetryEligibility,
  isApprovalDeliveryRetryCandidate,
  summarizeApprovalOperations,
} from './approval-management-model';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import { useApprovalManagementHighRiskCommand } from './approval-management-command-scope';
import { ApprovalLinkRow, ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';

import type { ApprovalIntegrationDelivery, ApprovalOperations } from '@dwp-frontend/shared-utils';
import {
  approvalOperationsDeliveryQueue,
  approvalOperationsQueueFromSearch,
  approvalOperationsRetrySnapshotCurrent,
  approvalOperationsSourceCurrent,
} from './approval-operations-workbench-model';
import type {
  ApprovalOperationsQueue,
  ApprovalOperationsSort,
  ApprovalOperationsStatus,
} from './approval-operations-workbench-model';

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
  const queryClient = useQueryClient();
  const { canOperate } = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const summary = summarizeApprovalOperations(operations.data);
  useEffect(() => {
    const expiresAt = Date.parse(operations.data?.generatedAt ?? '') + 45_000;
    if (!Number.isFinite(expiresAt)) return;
    const timer = window.setTimeout(
      () => expireSource((value) => value + 1),
      Math.max(1, expiresAt - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [operations.data?.generatedAt]);
  const deliveries = useMemo(
    () =>
      approvalOperationsDeliveryQueue(
        operations.data?.integrationDeliveries ?? [],
        queue,
        status,
        sort
      ),
    [operations.data?.integrationDeliveries, queue, status, sort]
  );
  const selectedTask = operations.data?.breachedTasks.find((task) => task.taskId === selectedId);
  const selected = useMemo(
    () => deliveries.find((delivery) => delivery.outboxId === selectedId) ?? null,
    [deliveries, selectedId]
  );

  useEffect(() => {
    const ids =
      queue === 'sla'
        ? (operations.data?.breachedTasks ?? []).map((task) => task.taskId)
        : deliveries.map((delivery) => delivery.outboxId);
    if (ids.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!ids.includes(selectedId ?? '')) {
      setSelectedId(ids[0]!);
    }
  }, [deliveries, operations.data?.breachedTasks, queue, selectedId]);

  const retryOriginal = useRef<Parameters<typeof approvalOperationsRetrySnapshotCurrent>[1]>(null);
  const latestScope = useRef({
    selectedId,
    scopeFingerprint: JSON.stringify(requestScope.cacheKey),
    canOperate: scopeReady && canOperate && queue === 'delivery',
  });
  latestScope.current = {
    selectedId,
    scopeFingerprint: JSON.stringify(requestScope.cacheKey),
    canOperate: scopeReady && canOperate && queue === 'delivery',
  };
  const assertRetryCurrent = () => {
    if (
      !approvalOperationsRetrySnapshotCurrent(
        queryClient.getQueryState<ApprovalOperations>(operationsQueryKey),
        retryOriginal.current,
        latestScope.current
      )
    )
      throw new Error('Approval recovery source changed');
  };

  const highRiskRetry = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'DELIVERY_RETRY',
    execute: (command, execution) => {
      assertRetryCurrent();
      if (
        retryOriginal.current?.outboxId !== command.targetId ||
        retryOriginal.current.expectedVersion !== command.expectedObjectVersion
      )
        throw new Error('Approval recovery command changed');
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
  const previousQueue = useRef(queue);
  useEffect(() => {
    if (previousQueue.current === queue) return;
    previousQueue.current = queue;
    setSelectedId(null);
    retryOriginal.current = null;
    closeHighRiskRetry();
  }, [queue, closeHighRiskRetry]);
  const resetScopeState = useCallback(() => {
    setSelectedId(null);
    setQueue('delivery');
    setStatus('ALL');
    setSort('OLDEST');
    retryOriginal.current = null;
    closeHighRiskRetry();
  }, [closeHighRiskRetry, setQueue]);
  useApprovalManagementScopeReset(requestScope.cacheKey, resetScopeState);
  const operationWriteReady =
    scopeReady &&
    operations.isSuccess &&
    !operations.isFetching &&
    operations.failureCount === 0 &&
    approvalOperationsSourceCurrent(
      queryClient.getQueryState<ApprovalOperations>(operationsQueryKey)
    ) &&
    canOperate;
  const formatTimestamp = (value?: string | null) =>
    value
      ? formatDate(
          value,
          { dateStyle: 'short', timeStyle: 'short' },
          resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
        )
      : t('admin.integrations.notAvailable');

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

  if (operations.isError) {
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
          {operations.data
            ? `${t('admin.metricDetail')} · ${formatTimestamp(operations.data.generatedAt)}`
            : t('admin.metricDetail')}
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
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' },
          gap: 1.25,
        }}
      >
        {(operations.data?.signals ?? []).map((signal) => (
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
            approvalOperationsSourceCurrent(
              queryClient.getQueryState<ApprovalOperations>(operationsQueryKey)
            )
              ? String(summary.retryCandidates)
              : t('admin.integrations.notAvailable')
          }
          detail={
            approvalOperationsSourceCurrent(
              queryClient.getQueryState<ApprovalOperations>(operationsQueryKey)
            )
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
            onChange={(_, value: ApprovalOperationsQueue) => {
              setQueue(value);
              setSelectedId(null);
              retryOriginal.current = null;
              closeHighRiskRetry();
            }}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={t('admin.operationsQueue.title')}
          >
            {(['sla', 'delivery', 'resolved'] as const).map((value) => (
              <Tab
                key={value}
                value={value}
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
              disabled={queue !== 'delivery'}
              options={(['ALL', 'PENDING', 'SENDING', 'FAILED', 'DEAD'] as const).map((value) => ({
                value,
                label:
                  value === 'ALL' ? t('admin.operationsQueue.allStatuses') : t(`status.${value}`),
              }))}
              onValueChange={(value) => {
                if (value) setStatus(value);
              }}
            />
            <SelectField
              size="small"
              label={t('admin.operationsQueue.sort')}
              value={sort}
              disabled={queue === 'sla'}
              options={(['OLDEST', 'NEWEST', 'AVAILABLE'] as const).map((value) => ({
                value,
                label: t(`admin.operationsQueue.sorts.${value}`),
              }))}
              onValueChange={(value) => {
                if (value) setSort(value);
              }}
            />
          </Box>
          <Box
            role="tabpanel"
            id={`approval-operations-${queue}-panel`}
            aria-labelledby={`approval-operations-${queue}-tab`}
            tabIndex={0}
          >
            {queue === 'sla' ? (
              (operations.data?.breachedTasks.length ?? 0) === 0 ? (
                <EmptyState
                  title={t('admin.assurance.states.enforced')}
                  description={t('admin.breached.meta')}
                  icon={<Activity size={24} />}
                />
              ) : (
                <Stack>
                  {operations.data?.breachedTasks.map((task) => (
                    <ButtonBase
                      key={task.taskId}
                      onClick={() => setSelectedId(task.taskId)}
                      aria-current={task.taskId === selectedId ? 'true' : undefined}
                      sx={{
                        p: 2,
                        textAlign: 'left',
                        display: 'block',
                        borderBottom: 1,
                        borderColor: 'divider',
                        bgcolor: task.taskId === selectedId ? 'action.selected' : 'transparent',
                      }}
                    >
                      <Box
                        sx={{
                          typography: 'body2',
                          fontWeight: 'fontWeightBold',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {task.title}
                      </Box>
                      <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                        {task.requestNumber} · {task.requesterName}
                      </Box>
                    </ButtonBase>
                  ))}
                </Stack>
              )
            ) : deliveries.length === 0 ? (
              <EmptyState
                title={t('admin.integrations.empty')}
                description={t('admin.integrations.meta')}
                icon={<CloudCog size={24} />}
              />
            ) : (
              <Stack
                component="ul"
                sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: 540, overflowY: 'auto' }}
              >
                {deliveries.map((delivery) => (
                  <DeliveryQueueRow
                    key={delivery.outboxId}
                    delivery={delivery}
                    selected={delivery.outboxId === selectedId}
                    updatedAt={formatTimestamp(
                      delivery.lastRetriedAt ?? delivery.publishedAt ?? delivery.createdAt
                    )}
                    onSelect={() => {
                      setSelectedId(delivery.outboxId);
                      retryOriginal.current = null;
                      closeHighRiskRetry();
                    }}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </ApprovalSurface>

        {queue === 'sla' && selectedTask ? (
          <ApprovalSurface title={selectedTask.title} meta={selectedTask.requestNumber}>
            <Stack gap={1.5} sx={{ p: 2 }}>
              <StatusChip status={selectedTask.status} />
              <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
                {selectedTask.summary}
              </Box>
              <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                {selectedTask.stepName} · {formatTimestamp(selectedTask.dueAt)}
              </Box>
              <ApprovalLinkRow
                title={t('actions.openDetails')}
                detail={selectedTask.requesterName ?? ''}
                route={`/approvals/inbox?task=${encodeURIComponent(selectedTask.taskId)}`}
                tone={approvalTone.primary}
              />
            </Stack>
          </ApprovalSurface>
        ) : selected ? (
          <DeliveryInspector
            delivery={selected}
            canOperate={operationWriteReady}
            busy={highRiskRetry.controller.busy}
            formatTimestamp={formatTimestamp}
            onRetry={(expectedVersion) => {
              if (!operationWriteReady) return;
              const latest = operations.data?.integrationDeliveries.find(
                (delivery) => delivery.outboxId === selected.outboxId
              );
              const eligibility = latest ? approvalDeliveryRetryEligibility(latest) : null;
              if (
                !latest ||
                !eligibility?.eligible ||
                eligibility.expectedVersion !== expectedVersion
              ) {
                return;
              }
              retryOriginal.current = {
                outboxId: latest.outboxId,
                expectedVersion,
                deliveryFingerprint: JSON.stringify(latest),
                scopeFingerprint: latestScope.current.scopeFingerprint,
              };
              if (
                !approvalOperationsRetrySnapshotCurrent(
                  queryClient.getQueryState<ApprovalOperations>(operationsQueryKey),
                  retryOriginal.current,
                  latestScope.current
                )
              ) {
                retryOriginal.current = null;
                return;
              }
              void highRiskRetry.begin(
                approvalDeliveryRetryCommand(latest.outboxId, expectedVersion)
              );
            }}
          />
        ) : (
          <EmptyState
            title={t('admin.integrations.empty')}
            description={t('admin.integrations.meta')}
            icon={<CloudCog size={24} />}
          />
        )}
      </Box>

      <ApprovalHighRiskCommandDialog controller={highRiskRetry.controller} />
    </Stack>
  );
}

function DeliveryQueueRow({
  delivery,
  selected,
  updatedAt,
  onSelect,
}: {
  delivery: ApprovalIntegrationDelivery;
  selected: boolean;
  updatedAt: string;
  onSelect: () => void;
}) {
  return (
    <Box component="li">
      <ButtonBase
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        sx={{
          width: 1,
          minHeight: 82,
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: selected ? alpha(approvalTone.primary, 0.075) : 'transparent',
          borderInlineStart: 3,
          borderInlineStartColor: selected ? approvalTone.primary : 'transparent',
          '&:hover': { bgcolor: alpha(approvalTone.primary, 0.05) },
        }}
      >
        {isApprovalDeliveryRetryCandidate(delivery) ? (
          <TriangleAlert size={17} color={approvalTone.amber} />
        ) : (
          <CloudCog size={17} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>{delivery.eventType}</Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{delivery.eventId}</Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{updatedAt}</Box>
        </Box>
        <StatusChip status={delivery.status} />
      </ButtonBase>
    </Box>
  );
}

function DeliveryInspector({
  delivery,
  canOperate,
  busy,
  formatTimestamp,
  onRetry,
}: {
  delivery: ApprovalIntegrationDelivery;
  canOperate: boolean;
  busy: boolean;
  formatTimestamp: (value?: string | null) => string;
  onRetry: (expectedVersion: number) => void;
}) {
  const { t } = useTranslation('approvals');
  const retryEligibility = approvalDeliveryRetryEligibility(delivery);
  const rows = [
    [t('admin.integrations.columns.status'), <StatusChip key="status" status={delivery.status} />],
    [
      t('admin.integrations.columns.attempts'),
      `${delivery.attemptCount}${delivery.manualRetryCount > 0 ? ` + ${delivery.manualRetryCount}` : ''}`,
    ],
    [
      t('admin.integrations.columns.updated'),
      formatTimestamp(delivery.lastRetriedAt ?? delivery.publishedAt ?? delivery.createdAt),
    ],
    [t('admin.operationsQueue.eventVersion'), t('admin.version', { version: delivery.version })],
    [t('admin.integrations.availableAt'), formatTimestamp(delivery.availableAt)],
    [t('admin.integrations.evaluatedAt'), formatTimestamp(retryEligibility.evaluatedAt)],
    [t('admin.integrations.requestId'), delivery.requestId ?? t('admin.integrations.notAvailable')],
    [
      t('admin.integrations.retry'),
      <StatusChip key="retry-eligibility" status={retryEligibility.reason} />,
    ],
  ] as const;

  return (
    <ApprovalSurface
      title={delivery.eventType}
      meta={delivery.eventId}
      action={<CloudCog size={18} />}
    >
      <Stack gap={2} sx={{ p: 2 }}>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
          {rows.map(([label, value]) => (
            <Box key={String(label)}>
              <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
                {label}
              </Box>
              <Box component="dd" sx={{ m: 0, mt: 0.35 }}>
                {typeof value === 'string' ? (
                  <Box
                    sx={{
                      typography: 'body2',
                      fontWeight: 'fontWeightBold',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {value}
                  </Box>
                ) : (
                  value
                )}
              </Box>
            </Box>
          ))}
        </Box>

        <InlineFeedback severity={delivery.lastError ? 'error' : 'info'}>
          <Box sx={{ typography: 'body2', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {delivery.lastError ?? t('admin.integrations.noError')}
          </Box>
        </InlineFeedback>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          gap={1.25}
        >
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {canOperate && retryEligibility.eligible
              ? t('admin.highRisk.description')
              : t('admin.integrations.retryRestricted')}
          </Box>
          <ActionButton
            intent="primary"
            startIcon={<RotateCcw size={17} />}
            disabled={!canOperate || !retryEligibility.eligible}
            loading={busy}
            onClick={() => {
              if (retryEligibility.expectedVersion !== null) {
                onRetry(retryEligibility.expectedVersion);
              }
            }}
          >
            {t('admin.integrations.retry')}
          </ActionButton>
        </Stack>
      </Stack>
    </ApprovalSurface>
  );
}
