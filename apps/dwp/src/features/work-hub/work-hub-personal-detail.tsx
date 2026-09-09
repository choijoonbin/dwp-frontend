import { useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileClock, Link2, Pencil, Trash2 } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  EntityTimeline,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  getPersonalWorkTask,
  getPersonalWorkTimeline,
} from '@dwp-frontend/shared-utils/api/personal-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { hydrateWorkSource } from './work-hub-source-hydration';
import { WorkPersonalChecklist } from './work-personal-checklist';
import { WorkSourceDetailSection } from './work-hub-source-detail-section';
import { openWorkHubSourceRoute } from './work-hub-actions';
import { workHubSourceStatusLabelKey } from './work-hub-presentation';
import {
  personalWorkStatusActionKind,
  useWorkHubPersonalCommand,
} from './use-work-hub-personal-command';
import { canExecuteWorkHubAction } from './work-hub-command-authority';
import type { WorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';
import { useWorkHubKeyboardShortcuts } from './use-work-hub-keyboard-shortcuts';

import type {
  PersonalWorkPage,
  PersonalWorkTask,
  PersonalWorkTimelineEvent,
  PersonalWorkStatus,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';

const TIMELINE_PAGE_SIZE = 100;
const LAST_SUPPORTED_TIMELINE_PAGE = 10_000;

type PersonalWorkTimelineReader = (
  taskId: string,
  page: number,
  size: number,
  signal?: AbortSignal
) => Promise<PersonalWorkPage<PersonalWorkTimelineEvent>>;

type TimelineActionTranslator = (key: string, options: { defaultValue: string }) => string;
type AuditActionDisplay = (domain: 'auditActions', code: string) => string;

export function personalWorkTimelineActionLabel(
  action: string,
  translate: TimelineActionTranslator,
  display: AuditActionDisplay
): string {
  return translate(`workHub.personal.timelineActions.${action}`, {
    defaultValue: display('auditActions', action),
  });
}

/** Status commands are always built from the latest owner-scoped detail receipt shown to the user. */
export function personalWorkStatusCommand(task: PersonalWorkTask, status: PersonalWorkStatus) {
  return { kind: 'STATUS' as const, version: task.version, status };
}

export function canSelectPersonalWorkStatus(
  task: PersonalWorkTask,
  item: WorkHubItem,
  snapshot: WorkHubSnapshot | undefined,
  status: PersonalWorkStatus
): boolean {
  const action = personalWorkStatusActionKind(status);
  return (
    status !== task.status &&
    isPersonalWorkDetailCurrent(task, item) &&
    action !== null &&
    canExecuteWorkHubAction(snapshot, item, action)
  );
}

export function isPersonalWorkDetailCurrent(task: PersonalWorkTask, item: WorkHubItem): boolean {
  return (
    item.reference.sourceSystem === 'PERSONAL_TASK' &&
    task.taskId === item.reference.sourceReference &&
    task.version === item.version &&
    task.status === item.lifecycle &&
    task.status === item.sourceStatus
  );
}

/** Loads the complete, page-based timeline without following a stalled server response forever. */
export async function loadCompletePersonalWorkTimeline(
  taskId: string,
  readPage: PersonalWorkTimelineReader = getPersonalWorkTimeline,
  signal?: AbortSignal
): Promise<PersonalWorkTimelineEvent[]> {
  const events = new Map<string, PersonalWorkTimelineEvent>();

  for (let page = 0; page <= LAST_SUPPORTED_TIMELINE_PAGE; page += 1) {
    signal?.throwIfAborted();
    const result = signal
      ? await readPage(taskId, page, TIMELINE_PAGE_SIZE, signal)
      : await readPage(taskId, page, TIMELINE_PAGE_SIZE);
    signal?.throwIfAborted();
    if (result.page !== page) throw new Error('Personal task timeline pagination did not advance');

    const previousSize = events.size;
    for (const event of result.items) {
      if (!events.has(event.eventId)) events.set(event.eventId, event);
    }

    if (!result.hasMore) return [...events.values()];
    if (events.size === previousSize)
      throw new Error('Personal task timeline pagination did not advance');
  }

  throw new Error('Personal task timeline pagination exceeded its supported range');
}

export function WorkHubPersonalDetail({
  item,
  ownerFingerprint,
  canEdit,
  preflight,
  mutationCoordinator,
  onEdit,
  snapshot,
  onDeleted,
  onOpenSource,
}: {
  item: WorkHubItem;
  ownerFingerprint: string | null;
  canEdit: boolean;
  preflight: () => Promise<WorkHubSnapshot | null>;
  mutationCoordinator?: WorkTaskSaveCoordinator;
  onEdit: (task: PersonalWorkTask) => void;
  snapshot?: WorkHubSnapshot;
  onDeleted?: () => void;
  onOpenSource?: (route: string) => void;
}) {
  const { t } = useTranslation('work');
  const shortcutHelpId = useId();
  const display = useDisplayDictionary();
  const queryClient = useQueryClient();
  const [deleteVersion, setDeleteVersion] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [retainedDetail, setRetainedDetail] = useState<{
    ownerFingerprint: string;
    task: PersonalWorkTask;
  } | null>(null);
  const taskId = item.reference.sourceReference;
  const detail = useQuery({
    queryKey: ['workspace', 'work-hub', 'personal-detail', taskId, item.version, ownerFingerprint],
    queryFn: async ({ signal }) => {
      const result = await getPersonalWorkTask(taskId, signal);
      if (result.taskId !== taskId)
        throw new HttpError('Personal work detail identity changed', 409);
      return result;
    },
    enabled: ownerFingerprint !== null,
    retry: false,
    meta: { accessSensitive: true },
  });
  const timeline = useQuery({
    queryKey: [
      'workspace',
      'work-hub',
      'personal-timeline',
      taskId,
      item.version,
      ownerFingerprint,
    ],
    queryFn: ({ signal }) =>
      loadCompletePersonalWorkTimeline(taskId, getPersonalWorkTimeline, signal),
    enabled: ownerFingerprint !== null,
    retry: false,
    meta: { accessSensitive: true },
  });
  const command = useWorkHubPersonalCommand({
    ownerFingerprint,
    taskId,
    reviewedItem: item,
    preflight,
    canEdit,
    mutationCoordinator,
    onConfirmed: async (_result, input) => {
      setDeleteVersion(null);
      setFeedback(
        input.kind === 'DELETE'
          ? 'deleted'
          : input.kind === 'CHECKLIST'
            ? 'checklistSaved'
            : 'statusSaved'
      );
      if (input.kind === 'DELETE') onDeleted?.();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
      ]);
    },
    onError: async (error) => {
      setDeleteVersion(null);
      const status = error instanceof HttpError ? error.status : undefined;
      setFeedback(
        status === 409
          ? 'conflict'
          : status === 401 || status === 403 || status === 404
            ? 'accessChanged'
            : 'commandUnknown'
      );
      await Promise.all([
        detail.refetch(),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
      ]);
    },
  });
  useEffect(() => {
    setDeleteVersion(null);
    setFeedback(null);
  }, [ownerFingerprint, taskId]);

  const detailAccessChanged =
    detail.isError &&
    detail.error instanceof HttpError &&
    detail.error.status < 500 &&
    detail.error.status !== 408 &&
    detail.error.status !== 429;
  useEffect(() => {
    if (ownerFingerprint === null || detailAccessChanged) {
      setRetainedDetail(null);
    } else if (detail.isSuccess && detail.data.taskId === taskId) {
      setRetainedDetail({ ownerFingerprint, task: detail.data });
    } else {
      setRetainedDetail((previous) =>
        previous?.ownerFingerprint === ownerFingerprint && previous.task.taskId === taskId
          ? previous
          : null
      );
    }
  }, [detail.data, detail.isSuccess, detailAccessChanged, ownerFingerprint, taskId]);
  // A version refresh must not unmount an unsaved checklist. Retained receipts are
  // display-only and cannot cross a task, owner, or revoked-access boundary.
  const task =
    ownerFingerprint === null || detailAccessChanged
      ? undefined
      : ((detail.isSuccess && detail.data.taskId === taskId ? detail.data : undefined) ??
        (retainedDetail?.ownerFingerprint === ownerFingerprint &&
        retainedDetail.task.taskId === taskId
          ? retainedDetail.task
          : undefined));

  const canManage = Boolean(
    task &&
    canEdit &&
    ownerFingerprint !== null &&
    isPersonalWorkDetailCurrent(task, item) &&
    detail.isSuccess &&
    !detail.isFetching &&
    !command.isPending
  );
  const canModify = canManage && task?.status !== 'ARCHIVED';
  const canComplete = Boolean(
    task && canManage && canSelectPersonalWorkStatus(task, item, snapshot, 'COMPLETED')
  );
  const completeTask = () => {
    if (task && canComplete)
      void command.run(personalWorkStatusCommand(task, 'COMPLETED')).catch(() => undefined);
  };
  const onShortcut = useWorkHubKeyboardShortcuts({
    onComplete: canComplete && deleteVersion === null ? completeTask : undefined,
    onEdit: task && canModify && deleteVersion === null ? () => onEdit(task) : undefined,
  });

  if (detail.isPending && !task)
    return <LoadingState size="standard" label={t('workHub.personal.loading')} />;
  if (!task) {
    return (
      <LocalErrorState
        size="standard"
        title={t('workHub.personal.unavailableTitle')}
        description={t('workHub.personal.unavailableDescription')}
        retryLabel={t('workPage.retry')}
        onRetry={() => void detail.refetch()}
        retrying={detail.isFetching}
      />
    );
  }
  const sources = task.sources ?? (task.source ? [task.source] : []);
  return (
    <Stack
      gap={2}
      role="region"
      tabIndex={0}
      aria-label={t('workHub.keyboardShortcuts.personalRegion')}
      aria-describedby={shortcutHelpId}
      onKeyDown={onShortcut}
      sx={{
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 4,
        },
      }}
    >
      <Typography id={shortcutHelpId} variant="caption" color="text.secondary">
        {t('workHub.keyboardShortcuts.personalHelp')}
      </Typography>
      {detail.isError && (
        <LocalErrorState
          size="compact"
          title={t('workHub.personal.unavailableTitle')}
          description={t('workHub.personal.unavailableDescription')}
          retryLabel={t('workPage.retry')}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      )}
      {feedback && (
        <InlineFeedback
          severity={
            ['deleted', 'checklistSaved', 'statusSaved'].includes(feedback) ? 'success' : 'warning'
          }
        >
          {t(`workHub.personal.${feedback}`)}
        </InlineFeedback>
      )}
      <ToggleButtonGroup
        value={task.status}
        exclusive
        size="small"
        aria-label={t('workHub.personal.statusProgress')}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          bgcolor: 'action.hover',
        }}
        onChange={(_event, status: PersonalWorkStatus | null) => {
          if (status && canManage && canSelectPersonalWorkStatus(task, item, snapshot, status)) {
            void command.run(personalWorkStatusCommand(task, status)).catch(() => undefined);
          }
        }}
      >
        {(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED'] as const).map((status) => (
          <ToggleButton
            key={status}
            value={status}
            aria-keyshortcuts={status === 'COMPLETED' && canComplete ? 'C' : undefined}
            disabled={!canManage || !canSelectPersonalWorkStatus(task, item, snapshot, status)}
            sx={{ minHeight: 44, minWidth: 0, px: 0.5, overflowWrap: 'anywhere' }}
          >
            {t(`workHub.lifecycle.${status}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Stack gap={1}>
        <Stack
          direction="row"
          justifyContent="space-between"
          gap={2}
          alignItems="flex-start"
          flexWrap="wrap"
        >
          <Box sx={{ flex: '1 1 12rem', minWidth: 0 }}>
            <Typography component="h3" variant="subtitle1">
              {t('workHub.personal.detailTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workHub.personal.lastUpdated', {
                date: formatDate(task.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
              })}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.25} flexWrap="wrap" justifyContent="flex-end">
            {canModify && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<Pencil size={16} />}
                sx={{ minHeight: 44 }}
                onClick={() => onEdit(task)}
                aria-keyshortcuts="E"
              >
                {t('workHub.personal.edit')}
              </ActionButton>
            )}
            {canEdit && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<Trash2 size={16} />}
                disabled={!canManage}
                onClick={() => setDeleteVersion(task.version)}
                sx={{ minHeight: 44, color: 'error.main' }}
              >
                {t('workHub.personal.delete')}
              </ActionButton>
            )}
          </Stack>
        </Stack>
        <Typography
          variant="body2"
          sx={{
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {task.description || t('workHub.personal.noDescription')}
        </Typography>
      </Stack>

      <WorkSourceDetailSection title={t('workHub.personal.linkedSource')} icon={Link2}>
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {sources.map((source, index) => {
            const hydrated = snapshot
              ? hydrateWorkSource(source, snapshot)
              : source.availability === 'AVAILABLE'
                ? { state: 'AVAILABLE' as const, source }
                : { state: source.availability, source: null };
            const verified = hydrated.state === 'AVAILABLE' ? hydrated.source : null;
            return (
              <Box
                key={index}
                sx={{
                  p: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                }}
              >
                <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                  {verified?.title ||
                    t(
                      source.availability === 'UNAVAILABLE'
                        ? 'workHub.personal.sourceUnavailable'
                        : 'workHub.personal.referenceOnly'
                    )}
                </Typography>
                {verified && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      {verified.reference.sourceSystem === 'SERVICE_REQUEST'
                        ? t(
                            workHubSourceStatusLabelKey(
                              verified.reference.sourceSystem,
                              verified.status
                            )
                          )
                        : display('states', verified.status)}
                    </Typography>
                    <ActionButton
                      data-work-source-trigger
                      data-work-item-key={item.key}
                      intent="quiet"
                      size="small"
                      disabled={!verified.sourceRoute}
                      onClick={() => {
                        if (!verified.sourceRoute) return;
                        if (onOpenSource) onOpenSource(verified.sourceRoute);
                        else openWorkHubSourceRoute(verified.sourceRoute);
                      }}
                      sx={{ display: 'flex', mt: 0.5, minHeight: 44 }}
                    >
                      {t('workHub.personal.openSource')}
                    </ActionButton>
                  </>
                )}
              </Box>
            );
          })}
        </Box>
        {!sources.length && (
          <Typography variant="body2" color="text.secondary">
            {t('workHub.taskSources.empty')}
          </Typography>
        )}
        {canModify && (
          <ActionButton
            intent="quiet"
            startIcon={<Link2 size={16} />}
            onClick={() => onEdit(task)}
            sx={{ mt: 1, minHeight: 44 }}
          >
            {t('workHub.personal.editSources')}
          </ActionButton>
        )}
      </WorkSourceDetailSection>

      <WorkPersonalChecklist
        key={`${ownerFingerprint}:${task.taskId}`}
        task={task}
        disabled={!canModify}
        onSave={async (checklist, version) => {
          await command.run({ kind: 'CHECKLIST', checklist, version });
        }}
      />

      {!timeline.isPending && !timeline.isError && !timeline.data?.length ? (
        <Box
          component="details"
          sx={{ '&[open] .work-timeline-disclosure': { transform: 'rotate(180deg)' } }}
        >
          <Stack
            component="summary"
            direction="row"
            gap={1}
            alignItems="center"
            sx={{ minHeight: 44, cursor: 'pointer', color: 'text.secondary' }}
          >
            <FileClock size={17} aria-hidden="true" />
            <Typography variant="body2">{t('workHub.personal.timeline')}</Typography>
            <ChevronDown size={16} className="work-timeline-disclosure" aria-hidden="true" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('workHub.personal.timelineEmpty')}
          </Typography>
        </Box>
      ) : (
        <Box>
          <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}>
            <FileClock size={17} aria-hidden="true" />
            <Typography component="h3" variant="subtitle1">
              {t('workHub.personal.timeline')}
            </Typography>
          </Stack>
          {timeline.isPending ? (
            <LoadingState size="compact" label={t('workHub.personal.timelineLoading')} />
          ) : timeline.isError ? (
            <InlineFeedback severity="warning">
              {t('workHub.personal.timelineUnavailable')}
            </InlineFeedback>
          ) : timeline.data && timeline.data.length > 0 ? (
            <EntityTimeline
              ariaLabel={t('workHub.personal.timeline')}
              items={timeline.data.map((event) => ({
                id: event.eventId,
                title: personalWorkTimelineActionLabel(event.action, t, display),
                status: t(`workHub.lifecycle.${event.status}`),
                timestamp: formatDate(event.occurredAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              }))}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('workHub.personal.timelineEmpty')}
            </Typography>
          )}
        </Box>
      )}
      <FormDialog
        open={deleteVersion !== null}
        title={t('workHub.personal.deleteTitle')}
        description={t('workHub.personal.deleteDescription', { title: task.title })}
        cancelLabel={t('workHub.taskForm.cancel')}
        submitLabel={t('workHub.personal.delete')}
        submitIntent="danger"
        busy={command.isPending}
        submitDisabled={!canManage || deleteVersion !== task.version}
        onClose={() => setDeleteVersion(null)}
        onSubmit={async () => {
          if (canManage && deleteVersion !== null && deleteVersion === task.version)
            await command.run({ kind: 'DELETE', version: deleteVersion }).catch(() => undefined);
        }}
        mobileFullScreen
      >
        <Typography variant="subtitle2">{task.title}</Typography>
      </FormDialog>
    </Stack>
  );
}
