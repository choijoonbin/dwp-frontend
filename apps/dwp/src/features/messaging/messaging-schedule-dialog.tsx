import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ContentDialog,
  dayjs,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  LocalDateTimePickerField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  cancelMessagingScheduledMessage,
  getMessagingScheduledMessages,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { resolveMessagingScheduleTime } from './messaging-schedule-time';

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultScheduleValue() {
  const date = new Date(Date.now() + 60 * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return localDateTimeValue(date);
}

export function MessagingScheduleDialog({
  open,
  bodyReady,
  attachmentBlocked,
  busy,
  error,
  onClose,
  onSchedule,
}: {
  open: boolean;
  bodyReady: boolean;
  attachmentBlocked: boolean;
  busy: boolean;
  error: boolean;
  onClose: () => void;
  onSchedule: (input: { scheduledFor: string; displayTimeZone: string }) => Promise<boolean>;
}) {
  const { t } = useTranslation('messaging');
  const queryClient = useQueryClient();
  const [localValue, setLocalValue] = useState(defaultScheduleValue);
  const [submitted, setSubmitted] = useState(false);
  const timeZone = resolveSystemTimeZone('UTC');
  const timeResolution = useMemo(
    () => resolveMessagingScheduleTime(localValue, timeZone),
    [localValue, timeZone]
  );
  const invalid =
    timeResolution.kind !== 'valid' || Date.parse(timeResolution.scheduledFor) <= Date.now();
  const timeError =
    timeResolution.kind === 'nonexistent'
      ? t('schedule.nonexistentTime')
      : timeResolution.kind === 'ambiguous'
        ? t('schedule.ambiguousTime')
        : submitted && invalid
          ? t('schedule.futureRequired')
          : undefined;
  const scheduledQuery = useInfiniteQuery({
    queryKey: ['messaging', 'scheduled-messages', 'PENDING'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getMessagingScheduledMessages({
        status: 'PENDING',
        cursor: pageParam ?? undefined,
        limit: 10,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    enabled: open,
    staleTime: 5_000,
  });
  const scheduledItems = useMemo(
    () => scheduledQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [scheduledQuery.data]
  );
  const cancelMutation = useMutation({
    mutationFn: cancelMessagingScheduledMessage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'scheduled-messages'] });
    },
  });

  useEffect(() => {
    if (!open) return;
    setLocalValue(defaultScheduleValue());
    setSubmitted(false);
  }, [open]);

  const submit = async () => {
    setSubmitted(true);
    if (timeResolution.kind !== 'valid' || invalid || !bodyReady || attachmentBlocked || busy)
      return;
    const succeeded = await onSchedule({
      scheduledFor: timeResolution.scheduledFor,
      displayTimeZone: timeZone,
    });
    if (succeeded) onClose();
  };

  return (
    <ContentDialog
      open={open}
      title={t('schedule.title')}
      description={t('schedule.description')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      busy={busy}
      maxWidth="sm"
    >
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Stack spacing={2}>
          {attachmentBlocked && (
            <InlineFeedback severity="warning">{t('schedule.attachmentBlocked')}</InlineFeedback>
          )}
          {!bodyReady && (
            <InlineFeedback severity="info">{t('schedule.bodyRequired')}</InlineFeedback>
          )}
          {error && <InlineFeedback severity="error">{t('schedule.error')}</InlineFeedback>}
          <LocalDateTimePickerField
            autoFocus
            required
            label={t('schedule.timeLabel')}
            value={localValue}
            disabled={busy}
            minDateTime={dayjs.utc(localDateTimeValue(new Date(Date.now() + 60_000)))}
            errorMessage={timeError}
            supportingText={t('schedule.timeZone', { timeZone })}
            onValueChange={(value) => setLocalValue(value ?? '')}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <ActionButton intent="quiet" disabled={busy} onClick={onClose}>
              {t('actions.cancel')}
            </ActionButton>
            <ActionButton
              type="submit"
              intent="primary"
              loading={busy}
              loadingLabel={t('schedule.scheduling')}
              disabled={invalid || !bodyReady || attachmentBlocked}
            >
              {t('schedule.confirm')}
            </ActionButton>
          </Stack>

          <Divider />
          <Box>
            <Typography variant="subtitle2">{t('schedule.pendingTitle')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('schedule.pendingDescription')}
            </Typography>
          </Box>
          {scheduledQuery.isPending ? (
            <LoadingState
              embedded
              size="compact"
              spinnerSize={16}
              label={t('schedule.pendingLoading')}
            />
          ) : scheduledQuery.isError && !scheduledQuery.data ? (
            <InlineFeedback
              severity="error"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => scheduledQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('schedule.pendingError')}
            </InlineFeedback>
          ) : scheduledItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('schedule.pendingEmpty')}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {scheduledItems.map((item) => (
                <Stack
                  key={item.scheduledMessageId}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                  sx={{
                    p: 1.25,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: foundationTokens.radius.surface + 'px',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {item.conversationName ?? t('schedule.conversationUnavailable')}
                    </Typography>
                    <Typography variant="body2" noWrap>
                      {item.body}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(item.scheduledFor, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: item.displayTimeZone,
                      })}
                    </Typography>
                  </Box>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    loading={
                      cancelMutation.isPending &&
                      cancelMutation.variables?.scheduledMessageId === item.scheduledMessageId
                    }
                    loadingLabel={t('schedule.cancelling')}
                    onClick={() =>
                      cancelMutation.mutate({
                        scheduledMessageId: item.scheduledMessageId,
                        version: item.version,
                      })
                    }
                  >
                    {t('schedule.cancel')}
                  </ActionButton>
                </Stack>
              ))}
              {cancelMutation.isError && (
                <InlineFeedback severity="error">{t('schedule.cancelError')}</InlineFeedback>
              )}
              {scheduledQuery.isFetchNextPageError && (
                <InlineFeedback severity="error">{t('schedule.pendingMoreError')}</InlineFeedback>
              )}
              {scheduledQuery.hasNextPage && (
                <ActionButton
                  intent="quiet"
                  loading={scheduledQuery.isFetchingNextPage}
                  loadingLabel={t('schedule.pendingLoadingMore')}
                  onClick={() => void scheduledQuery.fetchNextPage()}
                >
                  {t('schedule.pendingLoadMore')}
                </ActionButton>
              )}
            </Stack>
          )}
        </Stack>
      </Box>
    </ContentDialog>
  );
}
