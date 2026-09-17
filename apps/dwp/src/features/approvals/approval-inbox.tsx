import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock3,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormField,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import {
  formatDate,
  resolveSupportedLocale,
  useDisplayDictionary,
} from '@dwp-frontend/shared-i18n';
import { getApprovalTask, HttpError } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ApprovalPayloadData } from './approval-payload-data';
import { ApprovalCommandCenter } from './approval-command-center';
import { useApprovalCommandTaskSearch } from './use-approval-command-task-search';
import { approvalTaskContentAccess } from './approval-command-center-model';
import {
  approvalTimelineEventContext,
  approvalTimelineEventDetail,
} from './approval-timeline-copy';
import { ApprovalSurface, PriorityChip, StatusChip, approvalTone } from './approval-ui';
import { ApprovalCompletedDecisionEvidence } from './approval-completed-decision-evidence';
import { ApprovalTaskDocumentTools } from './approval-task-document-tools';
import { useApprovalTaskDocuments } from './use-approval-task-documents';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type { ApprovalTask, ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export function ApprovalInbox({ view = 'INBOX' }: { view?: 'INBOX' | 'COMPLETED' }) {
  return view === 'INBOX' ? <ApprovalCommandCenter /> : <ApprovalTaskArchive />;
}

function ApprovalTaskArchive() {
  const { t, i18n } = useTranslation('approvals');
  const display = useDisplayDictionary();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTaskId = searchParams.get('task') ?? undefined;
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState(searchParams.get('query') ?? '');
  const rawPage = Number(searchParams.get('page') ?? '0');
  const page = Number.isInteger(rawPage) && rawPage >= 0 && rawPage <= 100_000 ? rawPage : 0;
  const sort = searchParams.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST';
  const rawStatus = searchParams.get('status');
  const status = rawStatus === 'APPROVED' || rawStatus === 'REJECTED' ? rawStatus : '';
  const queueCopy = 'completed';
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const tasks = useApprovalCommandTaskSearch({
    view: 'COMPLETED',
    queue: 'ALL',
    search,
    page,
    sort,
    status,
    day: '',
    scope: requestScope,
  });
  const urlSearch = searchParams.get('query') ?? '';
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  const changeFilter = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSelectedId(undefined);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    if (!tasks.isFetching && !tasks.isError) return;
    if (tasks.isError) setSelectedId(undefined);
  }, [tasks.isError, tasks.isFetching]);
  useEffect(() => {
    if (tasks.isError || tasks.isFetching) return;
    if (!tasks.data?.length) {
      if (selectedId) setSelectedId(undefined);
      return;
    }
    if (selectedId && tasks.data.some((task) => task.taskId === selectedId)) return;
    const requested = tasks.data.find((task) => task.taskId === requestedTaskId);
    setSelectedId(requested?.taskId ?? tasks.data[0].taskId);
  }, [requestedTaskId, selectedId, tasks.data, tasks.isError, tasks.isFetching]);
  const detail = useQuery({
    queryKey: ['approvals', 'task', selectedId, ...requestScope.cacheKey],
    queryFn: ({ signal }) => getApprovalTask(selectedId!, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(selectedId) && !tasks.isError && !tasks.isFetching,
    staleTime: 0,
    retry: 1,
    meta: requestScope.queryMeta,
  });
  const selected =
    tasks.isFetching ||
    tasks.isError ||
    detail.isError ||
    detail.isFetching ||
    !requestScope.ready ||
    detail.data?.task.taskId !== selectedId
      ? undefined
      : detail.data;
  const selectedContentAccess = selected ? approvalTaskContentAccess(selected) : undefined;
  const cachedDocumentDetail = detail.data?.task.taskId === selectedId ? detail.data : undefined;
  const assertDocumentCurrent = () => {
    const queue = queryClient.getQueryState(tasks.queryKey);
    const current = queryClient.getQueryState<ApprovalTaskDetail>([
      'approvals',
      'task',
      selectedId,
      ...requestScope.cacheKey,
    ]);
    const latest = current?.data;
    if (
      !requestScope.ready ||
      !selectedId ||
      !cachedDocumentDetail ||
      queue?.status !== 'success' ||
      queue.error ||
      queue.fetchStatus !== 'idle' ||
      queue.fetchFailureCount > 0 ||
      current?.status !== 'success' ||
      current.error ||
      current.fetchStatus !== 'idle' ||
      current.fetchFailureCount > 0 ||
      !latest ||
      latest.task.taskId !== selectedId ||
      latest.task.requestId !== cachedDocumentDetail.task.requestId ||
      latest.task.version !== cachedDocumentDetail.task.version ||
      !approvalTaskContentAccess(latest).full
    )
      throw new HttpError('completed approval evidence source unavailable', 409);
  };
  const taskDocuments = useApprovalTaskDocuments(cachedDocumentDetail, assertDocumentCurrent, {
    taskId: selectedId,
    ready: Boolean(selected && selectedContentAccess?.full),
    error:
      [detail.failureReason, detail.error, tasks.failureReason, tasks.error].find(
        (error) => error instanceof HttpError && [401, 403, 404].includes(error.status)
      ) ??
      detail.failureReason ??
      detail.error ??
      tasks.failureReason ??
      tasks.error,
    refreshOwner: async () => {
      const expectedId = selectedId;
      const queue = await tasks.refetch();
      if (selectedId !== expectedId || !queue.isSuccess || queue.error)
        throw queue.error ?? new HttpError('completed approval queue refresh failed', 503);
      const refreshed = await detail.refetch();
      if (selectedId !== expectedId || !refreshed.isSuccess || refreshed.error || !refreshed.data)
        throw refreshed.error ?? new HttpError('completed approval evidence refresh failed', 503);
      return refreshed.data;
    },
  });

  return (
    <Paper
      variant="outlined"
      style={{ borderRadius: foundationTokens.radius.surface }}
      sx={{
        mt: 3,
        minHeight: 620,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(330px, 0.78fr) minmax(0, 1.6fr)' },
        overflow: 'hidden',
      }}
    >
      <Box sx={{ borderRight: { lg: 1 }, borderColor: 'divider', minWidth: 0 }}>
        <Box sx={{ px: 2, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography component="h2" variant="subtitle1" fontWeight={760}>
                {t(`${queueCopy}.queue`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`${queueCopy}.queueMeta`)}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={tasks.isError || tasks.isFetching ? '—' : (tasks.pageInfo?.totalElements ?? 0)}
            />
          </Stack>
          <Stack gap={1.5} sx={{ mt: 1.5 }}>
            <FormField
              label={t('requests.search.label')}
              value={search}
              inputProps={{ maxLength: 200 }}
              onChange={(event) => {
                setSearch(event.target.value);
                changeFilter({ query: event.target.value, page: '0' });
              }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>
              <SelectField
                label={t('requests.search.status')}
                value={status}
                options={[
                  { value: '', label: t('requests.search.allStatus') },
                  ...['APPROVED', 'REJECTED'].map((value) => ({
                    value,
                    label: t(`status.${value}`),
                  })),
                ]}
                onValueChange={(value) => changeFilter({ status: value ?? '', page: '0' })}
              />
              <SelectField
                label={t('requests.search.sort')}
                value={sort}
                options={['NEWEST', 'OLDEST'].map((value) => ({
                  value,
                  label: t(
                    value === 'NEWEST' ? 'requests.search.newest' : 'requests.search.oldest'
                  ),
                }))}
                onValueChange={(value) => {
                  if (value === 'NEWEST' || value === 'OLDEST')
                    changeFilter({ sort: value, page: '0' });
                }}
              />
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography variant="caption">
                {t('requests.drafts.page', {
                  page: page + 1,
                  total: Math.max(1, tasks.pageInfo?.totalPages ?? 1),
                })}
              </Typography>
              <Stack direction="row" gap={1}>
                <ActionIconButton
                  label={t('common:actions.previous')}
                  disabled={tasks.isFetching || page === 0}
                  onClick={() => changeFilter({ page: String(page - 1) })}
                >
                  <ArrowLeft size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('common:actions.next')}
                  disabled={tasks.isFetching || tasks.isError || !tasks.pageInfo?.hasNext}
                  onClick={() => changeFilter({ page: String(page + 1) })}
                >
                  <ArrowRight size={16} />
                </ActionIconButton>
              </Stack>
            </Stack>
          </Stack>
        </Box>
        {tasks.isError && (
          <Alert
            severity="error"
            sx={{ m: 1.5 }}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                disabled={tasks.isFetching}
                onClick={() => void tasks.refetch()}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t(`${queueCopy}.loadError`)}
          </Alert>
        )}
        <Box sx={{ maxHeight: { lg: 560 }, overflowY: 'auto' }}>
          {!tasks.isError &&
            (tasks.data ?? []).map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                selected={selectedId === task.taskId}
                disabled={tasks.isFetching}
                onClick={() => setSelectedId(task.taskId)}
              />
            ))}
          {!tasks.isLoading && !tasks.isError && tasks.data?.length === 0 && (
            <Box sx={{ px: 3, py: 8, textAlign: 'center' }}>
              <ShieldCheck size={32} color={approvalTone.teal} />
              <Typography component="p" variant="subtitle1" sx={{ mt: 1 }}>
                {t(`${queueCopy}.empty`)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(`${queueCopy}.emptyDescription`)}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0, bgcolor: 'background.default' }}>
        {tasks.isFetching && (
          <Box sx={{ minHeight: 560, display: 'grid', placeItems: 'center', px: 3 }}>
            <LoadingState label={t('common:labels.loading')} size="page" embedded />
          </Box>
        )}
        {!tasks.isFetching && selectedId && detail.isFetching && (
          <Box sx={{ minHeight: 560, display: 'grid', placeItems: 'center', px: 3 }}>
            <LoadingState label={t('common:labels.loading')} size="page" embedded />
          </Box>
        )}
        {!tasks.isFetching && selectedId && detail.isError && (
          <Box sx={{ minHeight: 560, display: 'grid', placeItems: 'center', px: 3 }}>
            <ErrorState
              title={t('inbox.detailLoadError')}
              retryLabel={t('actions.retry')}
              retrying={detail.isFetching}
              onRetry={() => void detail.refetch()}
              size="standard"
            />
          </Box>
        )}
        {!tasks.isFetching && !selectedId && !detail.isFetching && !detail.isError && (
          <Box
            sx={{
              minHeight: 560,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              px: 3,
            }}
          >
            <Box>
              <Box sx={{ color: 'text.secondary' }}>
                <MessageSquareText size={34} color="currentColor" />
              </Box>
              <Typography component="p" variant="subtitle1" sx={{ mt: 1 }}>
                {t(`${queueCopy}.select`)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(`${queueCopy}.selectDescription`)}
              </Typography>
            </Box>
          </Box>
        )}
        {selected && !selectedContentAccess?.full && (
          <Box sx={{ minHeight: 560, display: 'grid', placeItems: 'center', px: 3 }}>
            <Stack
              role="alert"
              alignItems="center"
              gap={1.25}
              sx={{ width: '100%', maxWidth: 520, textAlign: 'center' }}
            >
              <Box sx={{ color: 'warning.main' }}>
                <AlertTriangle size={34} aria-hidden="true" />
              </Box>
              <Typography component="h2" variant="h6">
                {t('home.commandCenter.contentAccess.title')}
              </Typography>
              <Typography color="text.secondary">
                {t('home.commandCenter.contentAccess.description')}
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap" justifyContent="center">
                <Chip size="small" variant="outlined" label={selected.task.requestNumber} />
                <StatusChip status={selectedContentAccess?.reason ?? 'UNKNOWN'} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t(
                  `home.commandCenter.contentAccess.reasons.${selectedContentAccess?.reason ?? 'UNKNOWN'}`
                )}
              </Typography>
            </Stack>
          </Box>
        )}
        {selected && selectedContentAccess?.full && (
          <Box>
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                py: 2.5,
                bgcolor: 'background.paper',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                <Box>
                  <Stack direction="row" gap={0.75} sx={{ mb: 1 }}>
                    <PriorityChip priority={selected.task.priority} />
                    <StatusChip status={selected.task.status} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`classification.${selected.task.dataClassification}`, {
                        defaultValue: selected.task.dataClassification,
                      })}
                    />
                  </Stack>
                  <Typography component="h2" variant="h5">
                    {selected.task.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {selected.task.summary}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 74, textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('inbox.risk')}
                  </Typography>
                  <Typography
                    component="p"
                    variant="h4"
                    color={
                      selected.task.riskScore >= 80
                        ? 'error.main'
                        : selected.task.riskScore >= 60
                          ? 'warning.main'
                          : 'primary.main'
                    }
                  >
                    {selected.task.riskScore}
                  </Typography>
                </Box>
              </Stack>
            </Box>
            {selected.selfApprovalBlocked && (
              <Alert severity="warning" icon={<AlertTriangle size={19} />} sx={{ m: 2 }}>
                {t('inbox.selfApprovalBlocked')}
              </Alert>
            )}
            <Box
              sx={{
                p: { xs: 2, md: 3 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)' },
                gap: 2,
              }}
            >
              <Stack gap={2}>
                <ApprovalCompletedDecisionEvidence detail={selected} />
                <ApprovalSurface
                  title={t('completed.evidence.documentTitle')}
                  meta={t('completed.evidence.documentMeta')}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('completed.evidence.documentDescription')}
                  </Typography>
                  <ApprovalTaskDocumentTools controller={taskDocuments} mode="evidence" />
                </ApprovalSurface>
                <ApprovalSurface title={t('inbox.context')} meta={selected.task.requestNumber}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    }}
                  >
                    {[
                      [t('inbox.requester'), selected.task.requesterName ?? '-'],
                      [t('inbox.organization'), selected.task.requesterOrgName ?? '-'],
                      [
                        t('inbox.workflow'),
                        resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko'
                          ? selected.task.workflowNameKo
                          : selected.task.workflowNameEn,
                      ],
                      [
                        t('inbox.currentStage'),
                        t('inbox.stageProgress', {
                          name: selected.task.stepName,
                          current: selected.task.stepSequence,
                        }),
                      ],
                      [
                        t('inbox.due'),
                        selected.task.dueAt
                          ? formatDate(selected.task.dueAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '-',
                      ],
                    ].map(([label, value]) => (
                      <Box
                        key={label}
                        sx={{ p: 2, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.35 }}>
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </ApprovalSurface>
                <ApprovalSurface title={t('inbox.requestData')}>
                  <ApprovalPayloadData
                    payload={selected.payload}
                    formSchema={selected.formSchema}
                  />
                </ApprovalSurface>
              </Stack>
              <ApprovalSurface title={t('inbox.timeline')} meta={t('inbox.timelineMeta')}>
                <Stack divider={<Divider flexItem />} sx={{ p: 2 }}>
                  {selected.timeline.map((event) => (
                    <Stack key={event.eventId} direction="row" gap={1.25} sx={{ py: 1.2 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          mt: 0.65,
                          flex: '0 0 8px',
                          borderRadius: '50%',
                          bgcolor: event.outcome === 'SUCCESS' ? 'success.main' : 'warning.main',
                        }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {t(`events.${event.eventType}`, {
                            defaultValue: display('auditActions', event.eventType),
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {approvalTimelineEventContext(t, event)} ·{' '}
                          {approvalTimelineEventDetail(t, event)} ·{' '}
                          {formatDate(event.occurredAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </ApprovalSurface>
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

function TaskRow({
  task,
  selected,
  disabled,
  onClick,
}: {
  task: ApprovalTask;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        width: 1,
        minHeight: 104,
        px: 2,
        py: 1.5,
        display: 'block',
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? alpha(approvalTone.primary, 0.08) : 'background.paper',
        boxShadow: selected ? `inset 3px 0 0 ${approvalTone.primary}` : 'none',
        '&:hover': { bgcolor: alpha(approvalTone.primary, 0.055) },
      }}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {task.requestNumber}
        </Typography>
        <Stack direction="row" gap={0.5}>
          <PriorityChip priority={task.priority} />
          <Chip
            size="small"
            icon={<Clock3 size={13} />}
            label={
              task.dueAt
                ? formatDate(task.dueAt, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-'
            }
          />
        </Stack>
      </Stack>
      <Typography variant="body2" fontWeight={760} noWrap sx={{ mt: 0.75 }}>
        {task.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {task.requesterName} · {task.requesterOrgName}
      </Typography>
      <Typography variant="caption" color="primary.main" noWrap sx={{ display: 'block', mt: 0.35 }}>
        {task.stepSequence}. {task.stepName}
      </Typography>
    </ButtonBase>
  );
}
