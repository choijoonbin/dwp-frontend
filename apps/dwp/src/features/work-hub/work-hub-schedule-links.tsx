import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

import { canUnlinkWorkSchedule, canUseWorkHubGenericAdjunct } from './work-hub-command-authority';
import { workHubReferenceKey, type WorkHubItem, type WorkHubSnapshot } from './work-hub-contracts';
import {
  exactCurrentWorkScheduleLink,
  type loadWorkSchedules,
  type unlinkWorkSchedule,
} from './work-hub-scheduling';

type ScheduleLoad = Awaited<ReturnType<typeof loadWorkSchedules>>;
type ScheduleRow = ScheduleLoad['items'][number];

export const workHubScheduleLinksQueryKey = ['workspace', 'work-hub', 'schedule-links'] as const;

export type WorkHubScheduleLinksProps = {
  item: WorkHubItem;
  ownerFingerprint: string | null;
  from: string;
  to: string;
  canUnlink: boolean;
  preflight: () => Promise<WorkHubSnapshot | null>;
  loadSchedules: typeof loadWorkSchedules;
  unlinkSchedule: typeof unlinkWorkSchedule;
  onOpenCalendar: () => void;
};

/** Displays personal link metadata without implying that Work owns Calendar events. */
export function WorkHubScheduleLinks({
  item,
  ownerFingerprint,
  from,
  to,
  canUnlink,
  preflight,
  loadSchedules,
  unlinkSchedule,
  onOpenCalendar,
}: WorkHubScheduleLinksProps) {
  const { t } = useTranslation(['work', 'common']);
  const queryClient = useQueryClient();
  const [unlinkTarget, setUnlinkTarget] = useState<ScheduleRow | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [unlinkFailed, setUnlinkFailed] = useState(false);
  const [unlinkSucceeded, setUnlinkSucceeded] = useState(false);
  const mounted = useRef(true);
  const activeUnlink = useRef<AbortController | null>(null);
  const supported = canUseWorkHubGenericAdjunct(item, 'CALENDAR');
  const readScope = ownerFingerprint ? `${ownerFingerprint}:${item.key}` : null;
  const readScopeRef = useRef(readScope);
  readScopeRef.current = readScope;
  const operationScope =
    ownerFingerprint && canUnlink
      ? `${ownerFingerprint}:${item.sourceId}:${item.key}:${item.version}:${item.lifecycle}:${item.sourceStatus}`
      : null;
  const operationScopeRef = useRef(operationScope);
  operationScopeRef.current = operationScope;
  const scheduleQueryKey = [...workHubScheduleLinksQueryKey, ownerFingerprint, from, to] as const;
  const schedules = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: ({ signal }) => {
      const submittedScope = readScope;
      return loadSchedules(from, to, {
        signal,
        canContinue: () => !signal.aborted && readScopeRef.current === submittedScope,
      });
    },
    enabled: ownerFingerprint !== null && supported,
    staleTime: 30_000,
    retry: false,
    meta: { accessSensitive: true },
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeUnlink.current?.abort();
    };
  }, []);

  useEffect(() => {
    activeUnlink.current?.abort();
    activeUnlink.current = null;
    setUnlinkTarget(null);
    setRemoved(new Set());
    setUnlinkFailed(false);
    setUnlinkSucceeded(false);
  }, [item.key, operationScope]);

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
    mutationFn: async ({
      row,
      reviewedItem,
      submittedScope,
    }: {
      row: ScheduleRow;
      reviewedItem: WorkHubItem;
      submittedScope: string;
      queryOwner: string;
    }) => {
      if (operationScopeRef.current !== submittedScope)
        throw new DOMException('Work owner changed', 'AbortError');
      const controller = new AbortController();
      activeUnlink.current?.abort();
      activeUnlink.current = controller;
      const freshSnapshot = await preflight();
      if (controller.signal.aborted || operationScopeRef.current !== submittedScope)
        throw new DOMException('Work owner changed', 'AbortError');
      if (!canUnlinkWorkSchedule(freshSnapshot, reviewedItem))
        throw new Error('Work changed after review');
      const canContinue = () =>
        !controller.signal.aborted && operationScopeRef.current === submittedScope;
      const currentSchedules = await loadSchedules(from, to, {
        signal: controller.signal,
        canContinue,
      });
      if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
      if (currentSchedules.state === 'UNAVAILABLE')
        throw new Error('Schedule links are unavailable');
      const currentLink = exactCurrentWorkScheduleLink(
        currentSchedules.items.map((candidate) => candidate.link),
        row.link
      );
      if (!currentLink) throw new Error('Schedule link changed after review');
      const result = await unlinkSchedule(currentLink, {
        signal: controller.signal,
        canContinue,
      });
      if (
        result.link.state !== 'REMOVED' ||
        result.calendarChanged !== false ||
        result.sourceChanged !== false
      ) {
        throw new Error('Schedule link removal was not confirmed');
      }
      return { result, submittedScope };
    },
    onSuccess: ({ result, submittedScope }) => {
      if (!mounted.current || operationScopeRef.current !== submittedScope) return;
      setRemoved((current) => new Set(current).add(result.link.linkId));
      setUnlinkTarget(null);
      setUnlinkFailed(false);
      setUnlinkSucceeded(true);
    },
    onError: (error) => {
      if (
        !mounted.current ||
        !operationScopeRef.current ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        return;
      setUnlinkFailed(true);
    },
    onSettled: (_data, _error, variables) => {
      activeUnlink.current = null;
      void queryClient.invalidateQueries({
        queryKey: [...workHubScheduleLinksQueryKey, variables.queryOwner, from, to],
        exact: true,
      });
    },
  });

  if (!supported) return null;

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
              data-testid="work-hub-schedule-link-card"
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              }}
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
        open={Boolean(unlinkTarget) && canUnlink && operationScope !== null}
        title={t('workHub.scheduleLinks.confirmTitle')}
        description={t('workHub.scheduleLinks.confirmDescription')}
        cancelLabel={t('workHub.scheduleLinks.keep')}
        confirmLabel={t('workHub.scheduleLinks.confirm')}
        busy={unlink.isPending}
        onClose={() => {
          if (!unlink.isPending) setUnlinkTarget(null);
        }}
        onConfirm={() => {
          if (
            unlinkTarget &&
            canUnlink &&
            ownerFingerprint &&
            operationScopeRef.current &&
            !unlink.isPending
          )
            unlink.mutate({
              row: unlinkTarget,
              reviewedItem: item,
              submittedScope: operationScopeRef.current,
              queryOwner: ownerFingerprint,
            });
        }}
      />
    </Box>
  );
}
