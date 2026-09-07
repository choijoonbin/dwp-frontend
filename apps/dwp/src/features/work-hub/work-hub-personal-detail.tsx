import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileClock, Link2, Pencil } from 'lucide-react';
import {
  ActionButton,
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

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  PersonalWorkPage,
  PersonalWorkTask,
  PersonalWorkTimelineEvent,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkHubItem } from './work-hub-contracts';

const TIMELINE_PAGE_SIZE = 100;
const LAST_SUPPORTED_TIMELINE_PAGE = 10_000;

type PersonalWorkTimelineReader = (
  taskId: string,
  page: number,
  size: number
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

/** Loads the complete, page-based timeline without following a stalled server response forever. */
export async function loadCompletePersonalWorkTimeline(
  taskId: string,
  readPage: PersonalWorkTimelineReader = getPersonalWorkTimeline
): Promise<PersonalWorkTimelineEvent[]> {
  const events = new Map<string, PersonalWorkTimelineEvent>();

  for (let page = 0; page <= LAST_SUPPORTED_TIMELINE_PAGE; page += 1) {
    const result = await readPage(taskId, page, TIMELINE_PAGE_SIZE);
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
  canEdit,
  onEdit,
}: {
  item: WorkHubItem;
  canEdit: boolean;
  onEdit: (task: PersonalWorkTask) => void;
}) {
  const { t } = useTranslation('work');
  const display = useDisplayDictionary();
  const taskId = item.reference.sourceReference;
  const detail = useQuery({
    queryKey: ['workspace', 'work-hub', 'personal-detail', taskId, item.version],
    queryFn: () => getPersonalWorkTask(taskId),
    retry: false,
    meta: { accessSensitive: true },
  });
  const timeline = useQuery({
    queryKey: ['workspace', 'work-hub', 'personal-timeline', taskId, item.version],
    queryFn: () => loadCompletePersonalWorkTimeline(taskId),
    retry: false,
    meta: { accessSensitive: true },
  });

  if (detail.isPending)
    return <LoadingState size="standard" label={t('workHub.personal.loading')} />;
  if (detail.isError || !detail.data) {
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
  const task = detail.data;
  return (
    <Stack gap={3}>
      <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
        <Box>
          <Typography component="h3" variant="subtitle1">
            {t('workHub.personal.detailTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {task.description || t('workHub.personal.noDescription')}
          </Typography>
        </Box>
        {canEdit && (
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Pencil size={16} />}
            sx={{ minHeight: 44 }}
            onClick={() => onEdit(task)}
          >
            {t('workHub.personal.edit')}
          </ActionButton>
        )}
      </Stack>

      {task.source && (
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 'shape.borderRadius' }}>
          <Stack direction="row" gap={1} alignItems="flex-start">
            <Link2 size={17} aria-hidden="true" />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2">{t('workHub.personal.linkedSource')}</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
              >
                {task.source.availability === 'AVAILABLE'
                  ? task.source.title
                  : task.source.availability === 'REFERENCE_ONLY'
                    ? t('workHub.personal.referenceOnly')
                    : t('workHub.personal.sourceUnavailable')}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

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
              timestamp: formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short' }),
            }))}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('workHub.personal.timelineEmpty')}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
