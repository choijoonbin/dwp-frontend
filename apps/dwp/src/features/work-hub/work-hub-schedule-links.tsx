import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Unlink } from 'lucide-react';
import {
  ActionButton,
  ConfirmDialog,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workHubReferenceKey, type WorkHubItem } from './work-hub-contracts';
import type { loadWorkSchedules, unlinkWorkSchedule } from './work-hub-scheduling';

type ScheduleLoad = Awaited<ReturnType<typeof loadWorkSchedules>>;
type ScheduleRow = ScheduleLoad['items'][number];

export const workHubScheduleLinksQueryKey = ['workspace', 'work-hub', 'schedule-links'] as const;

export type WorkHubScheduleLinksProps = {
  item: WorkHubItem;
  from: string;
  to: string;
  canUnlink: boolean;
  loadSchedules: typeof loadWorkSchedules;
  unlinkSchedule: typeof unlinkWorkSchedule;
  onOpenCalendar: () => void;
};

/** Displays personal link metadata without implying that Work owns Calendar events. */
export function WorkHubScheduleLinks({
  item,
  from,
  to,
  canUnlink,
  loadSchedules,
  unlinkSchedule,
  onOpenCalendar,
}: WorkHubScheduleLinksProps) {
  const { t } = useTranslation(['work', 'common']);
  const [unlinkTarget, setUnlinkTarget] = useState<ScheduleRow | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [unlinkFailed, setUnlinkFailed] = useState(false);
  const [unlinkSucceeded, setUnlinkSucceeded] = useState(false);
  const schedules = useQuery({
    queryKey: [...workHubScheduleLinksQueryKey, from, to],
    queryFn: () => loadSchedules(from, to),
    staleTime: 30_000,
    retry: false,
    meta: { accessSensitive: true },
  });

  useEffect(() => {
    setUnlinkTarget(null);
    setRemoved(new Set());
    setUnlinkFailed(false);
    setUnlinkSucceeded(false);
  }, [item.key]);

  const rows = useMemo(
    () =>
      (schedules.data?.items ?? []).filter(
        (row) =>
          row.link.state === 'LINKED' &&
          workHubReferenceKey(row.link.work) === item.key &&
          !removed.has(row.link.linkId)
      ),
    [item.key, removed, schedules.data?.items]
  );
  const unlink = useMutation({
    mutationFn: async (row: ScheduleRow) => {
      const result = await unlinkSchedule(row.link);
      if (
        result.link.state !== 'REMOVED' ||
        result.calendarChanged !== false ||
        result.sourceChanged !== false
      ) {
        throw new Error('Schedule link removal was not confirmed');
      }
      return result;
    },
    onSuccess: (result) => {
      setRemoved((current) => new Set(current).add(result.link.linkId));
      setUnlinkTarget(null);
      setUnlinkFailed(false);
      setUnlinkSucceeded(true);
      void schedules.refetch();
    },
    onError: () => setUnlinkFailed(true),
  });

  return (
    <Box component="section" aria-labelledby="work-hub-schedule-links-title">
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Stack direction="row" gap={1} alignItems="center">
          <CalendarClock size={18} aria-hidden="true" />
          <Typography id="work-hub-schedule-links-title" component="h3" variant="subtitle1">
            {t('workHub.scheduleLinks.title')}
          </Typography>
        </Stack>
        <ActionButton intent="quiet" onClick={onOpenCalendar} sx={{ minHeight: 44 }}>
          {t('workHub.scheduleLinks.openCalendar')}
        </ActionButton>
      </Stack>

      {schedules.isPending ? (
        <LoadingState
          size="compact"
          label={t('workHub.scheduleLinks.loading')}
          variant="skeleton"
        />
      ) : (
        <Stack gap={1.25} sx={{ mt: 1.5 }}>
          {(schedules.isError || schedules.data?.state === 'UNAVAILABLE') && (
            <InlineFeedback severity="warning">
              {t('workHub.scheduleLinks.unavailable')}
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() => void schedules.refetch()}
                sx={{ minHeight: 44, ml: 1 }}
              >
                {t('workPage.retry')}
              </ActionButton>
            </InlineFeedback>
          )}
          {schedules.data?.state === 'PARTIAL' && (
            <InlineFeedback severity="warning">{t('workHub.scheduleLinks.partial')}</InlineFeedback>
          )}
          {unlinkSucceeded && (
            <InlineFeedback
              severity="success"
              onClose={() => setUnlinkSucceeded(false)}
              closeLabel={t('common:actions.close')}
            >
              {t('workHub.scheduleLinks.unlinked')}
            </InlineFeedback>
          )}
          {unlinkFailed && (
            <InlineFeedback severity="error">
              {t('workHub.scheduleLinks.unlinkFailed')}
            </InlineFeedback>
          )}
          {rows.map((row) => (
            <Box
              key={row.link.linkId}
              sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 'shape.borderRadius' }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                gap={1.5}
                alignItems={{ sm: 'center' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  {row.event ? (
                    <>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {row.event.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(row.event.startsAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}{' '}
                        – {formatDate(row.event.endsAt, { timeStyle: 'short' })}
                      </Typography>
                      {row.state === 'CANCELLED' && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="warning"
                          label={t('workHub.scheduleLinks.cancelled')}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('workHub.scheduleLinks.detailsUnavailable')}
                    </Typography>
                  )}
                </Box>
                {canUnlink && (
                  <ActionButton
                    intent="quiet"
                    startIcon={<Unlink size={16} aria-hidden="true" />}
                    disabled={unlink.isPending}
                    onClick={() => {
                      setUnlinkFailed(false);
                      setUnlinkTarget(row);
                    }}
                    sx={{ minHeight: 44, flexShrink: 0 }}
                  >
                    {t('workHub.scheduleLinks.unlink')}
                  </ActionButton>
                )}
              </Stack>
            </Box>
          ))}
          {!schedules.isError && schedules.data?.state !== 'UNAVAILABLE' && rows.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('workHub.scheduleLinks.empty')}
            </Typography>
          )}
        </Stack>
      )}

      <ConfirmDialog
        open={Boolean(unlinkTarget)}
        title={t('workHub.scheduleLinks.confirmTitle')}
        description={t('workHub.scheduleLinks.confirmDescription')}
        cancelLabel={t('workHub.scheduleLinks.keep')}
        confirmLabel={t('workHub.scheduleLinks.confirm')}
        busy={unlink.isPending}
        onClose={() => {
          if (!unlink.isPending) setUnlinkTarget(null);
        }}
        onConfirm={() => {
          if (unlinkTarget && !unlink.isPending) unlink.mutate(unlinkTarget);
        }}
      />
    </Box>
  );
}
