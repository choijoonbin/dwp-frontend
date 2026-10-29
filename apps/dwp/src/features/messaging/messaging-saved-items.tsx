import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookmarkX,
  CalendarClock,
  CheckCircle2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  formatDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import {
  getMessagingLaterItems,
  unsaveMessagingMessage,
  updateMessagingLaterItem,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ContentDialog,
  ErrorState,
  FormField,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  messagingInitials,
  messagingRelativeTime,
  MessagingPageHeading,
} from './messaging-components';
import { messagingConversationHref } from './messaging-deep-link';
import { resolveMessagingScheduleTime } from './messaging-schedule-time';
import { messagingVisualTone, messagingVisualTokens } from './messaging-visual-model';

import type {
  MessagingLaterFilter,
  MessagingLaterItem,
  MessagingLaterState,
} from '@dwp-frontend/shared-utils';

const PAGE_SIZE = 30;
const LATER_FILTERS: readonly MessagingLaterFilter[] = [
  'ALL',
  'SAVED',
  'SNOOZED',
  'DUE',
  'COMPLETED',
];

function laterFilter(value: string | null): MessagingLaterFilter {
  return LATER_FILTERS.includes(value as MessagingLaterFilter)
    ? (value as MessagingLaterFilter)
    : 'ALL';
}

function pageNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultSnoozeValue() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
  tomorrow.setMinutes(Math.ceil(tomorrow.getMinutes() / 5) * 5, 0, 0);
  return localDateTimeValue(tomorrow);
}

export function MessagingSavedItems() {
  const { t, i18n } = useTranslation('messaging');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const state = laterFilter(params.get('state'));
  const search = params.get('q') ?? '';
  const page = pageNumber(params.get('page'));
  const [snoozeItem, setSnoozeItem] = useState<MessagingLaterItem | null>(null);
  const [snoozeValue, setSnoozeValue] = useState(defaultSnoozeValue);

  const query = useQuery({
    queryKey: ['messaging', 'later', state, search, page],
    queryFn: () =>
      getMessagingLaterItems({ state, query: search.trim(), page, pageSize: PAGE_SIZE }),
    staleTime: 15_000,
    retry: 1,
  });
  const refreshLater = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['messaging', 'later'] }),
      queryClient.invalidateQueries({ queryKey: ['messaging', 'saved-items'] }),
      queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] }),
    ]);
  };
  const updateMutation = useMutation({
    mutationFn: updateMessagingLaterItem,
    onSuccess: async () => {
      toast.success(t('laterPage.updateSuccess'));
      setSnoozeItem(null);
      await refreshLater();
    },
    onError: async () => {
      toast.error(t('laterPage.updateError'));
      await refreshLater();
    },
  });
  const removeMutation = useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      unsaveMessagingMessage(conversationId, messageId),
    onSuccess: async () => {
      toast.success(t('saved.removeSuccess'));
      await refreshLater();
    },
    onError: () => toast.error(t('saved.removeError')),
  });
  const updateUrl = (changes: Partial<Record<'state' | 'q' | 'page', string>>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === 'ALL' || (key === 'page' && value === '0')) next.delete(key);
      else next.set(key, value);
    });
    setParams(next, { replace: true });
  };
  const updateState = (
    item: MessagingLaterItem,
    nextState: Exclude<MessagingLaterState, 'DUE'>,
    snoozedUntil?: string
  ) => {
    updateMutation.mutate({
      messageId: item.messageId,
      state: nextState,
      version: item.version,
      ...(snoozedUntil
        ? { snoozedUntil, reminderAt: snoozedUntil }
        : { snoozedUntil: null, reminderAt: null }),
    });
  };
  const data = query.data;
  const hasPrevious = page > 0;
  const hasNext = Boolean(data && (page + 1) * data.pageSize < data.total);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const snoozeTimeZone = resolveSystemTimeZone('UTC');
  const snoozeResolution = useMemo(
    () => resolveMessagingScheduleTime(snoozeValue, snoozeTimeZone),
    [snoozeTimeZone, snoozeValue]
  );
  const snoozeInvalid =
    snoozeResolution.kind !== 'valid' || Date.parse(snoozeResolution.scheduledFor) <= Date.now();
  const snoozeError =
    snoozeResolution.kind === 'nonexistent'
      ? t('laterPage.snoozeDialog.nonexistentTime')
      : snoozeResolution.kind === 'ambiguous'
        ? t('laterPage.snoozeDialog.ambiguousTime')
        : snoozeInvalid
          ? t('laterPage.snoozeDialog.futureRequired')
          : undefined;

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('laterPage.eyebrow')}
        title={t('laterPage.title')}
        description={t('laterPage.description')}
        actions={
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={17} aria-hidden="true" />}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      <Box component="section" aria-labelledby="messaging-later-results" sx={{ mt: 2.5 }}>
        <Stack spacing={1.25}>
          <TextField
            size="small"
            value={search}
            onChange={(event) => updateUrl({ q: event.target.value, page: '0' })}
            label={t('laterPage.search')}
            placeholder={t('laterPage.searchPlaceholder')}
            sx={{ width: { xs: 1, sm: 390 }, maxWidth: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={state}
            onChange={(_, value: MessagingLaterFilter | null) =>
              value && updateUrl({ state: value, page: '0' })
            }
            aria-label={t('laterPage.stateFilter')}
            sx={{ alignSelf: 'flex-start', maxWidth: 1, flexWrap: 'wrap' }}
          >
            {LATER_FILTERS.map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`laterPage.states.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 2, mb: 1 }}>
          <Typography id="messaging-later-results" component="h2" variant="subtitle1">
            {t('laterPage.results')}
          </Typography>
          {!query.isPending && !query.isError && (
            <Typography variant="caption" color="text.secondary" aria-live="polite">
              {t('laterPage.resultCount', { count: data?.total ?? 0 })}
            </Typography>
          )}
        </Stack>

        {query.isPending ? (
          <LoadingState label={t('laterPage.loading')} />
        ) : query.isError ? (
          <ErrorState
            title={t('laterPage.loadError')}
            retryLabel={t('actions.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        ) : data?.items.length ? (
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: messagingVisualTokens.radius.surface,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {data.items.map((item) => (
              <Box
                key={`${item.conversationId}:${item.messageId}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  gap: { xs: 1, sm: 1.5 },
                  alignItems: 'start',
                  minWidth: 0,
                  px: { xs: 1.25, sm: 2 },
                  py: 1.6,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Avatar
                  sx={(theme) => {
                    const tone = messagingVisualTone(item.senderName);
                    return {
                      width: 38,
                      height: 38,
                      fontSize: 12,
                      fontWeight: 800,
                      bgcolor:
                        theme.palette.mode === 'dark' ? alpha(tone.foreground, 0.28) : tone.surface,
                      color: theme.palette.mode === 'dark' ? tone.surface : tone.foreground,
                    };
                  }}
                >
                  {messagingInitials(item.senderName)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={800}>
                      {item.senderName}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={item.conversationName || t('laterPage.unnamedConversation')}
                      sx={{ height: 21 }}
                    />
                    <Chip
                      size="small"
                      variant={item.state === 'COMPLETED' ? 'outlined' : 'filled'}
                      color={
                        item.state === 'DUE'
                          ? 'warning'
                          : item.state === 'COMPLETED'
                            ? 'success'
                            : 'default'
                      }
                      label={t(`laterPage.states.${item.state}`)}
                      sx={{ height: 21 }}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    color={
                      item.protectedContent || item.messageDeleted
                        ? 'text.secondary'
                        : 'text.primary'
                    }
                    sx={{ mt: 0.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {item.messageDeleted
                      ? t('message.deleted')
                      : item.protectedContent
                        ? t('laterPage.protectedPreview')
                        : item.preview || t('laterPage.noPreview')}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.35 }}
                  >
                    {item.state === 'SNOOZED' && item.snoozedUntil
                      ? t('laterPage.snoozedUntil', {
                          time: formatDate(
                            item.snoozedUntil,
                            { dateStyle: 'medium', timeStyle: 'short' },
                            locale
                          ),
                        })
                      : t('laterPage.savedAt', {
                          time: messagingRelativeTime(item.savedAt, locale),
                        })}
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<MessageSquareText size={15} aria-hidden="true" />}
                      onClick={() =>
                        navigate(
                          messagingConversationHref({
                            conversationId: item.conversationId,
                            messageId: item.messageId,
                          })
                        )
                      }
                    >
                      {t('saved.openConversation')}
                    </ActionButton>
                    {item.state === 'COMPLETED' ? (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<RotateCcw size={15} aria-hidden="true" />}
                        disabled={updateMutation.isPending}
                        onClick={() => updateState(item, 'SAVED')}
                      >
                        {t('laterPage.reopen')}
                      </ActionButton>
                    ) : (
                      <>
                        <ActionButton
                          intent="quiet"
                          size="small"
                          startIcon={<CalendarClock size={15} aria-hidden="true" />}
                          disabled={updateMutation.isPending}
                          onClick={() => {
                            setSnoozeValue(defaultSnoozeValue());
                            setSnoozeItem(item);
                          }}
                        >
                          {item.state === 'SNOOZED'
                            ? t('laterPage.reschedule')
                            : t('laterPage.snooze')}
                        </ActionButton>
                        {item.state === 'SNOOZED' && (
                          <ActionButton
                            intent="quiet"
                            size="small"
                            startIcon={<RotateCcw size={15} aria-hidden="true" />}
                            disabled={updateMutation.isPending}
                            onClick={() => updateState(item, 'SAVED')}
                          >
                            {t('laterPage.restore')}
                          </ActionButton>
                        )}
                        <ActionButton
                          intent="quiet"
                          size="small"
                          startIcon={<CheckCircle2 size={15} aria-hidden="true" />}
                          disabled={updateMutation.isPending}
                          onClick={() => updateState(item, 'COMPLETED')}
                        >
                          {t('laterPage.complete')}
                        </ActionButton>
                      </>
                    )}
                  </Stack>
                </Box>
                <ActionIconButton
                  label={t('saved.remove')}
                  disabled={removeMutation.isPending || updateMutation.isPending}
                  onClick={() =>
                    removeMutation.mutate({
                      conversationId: item.conversationId,
                      messageId: item.messageId,
                    })
                  }
                >
                  <BookmarkX size={17} aria-hidden="true" />
                </ActionIconButton>
              </Box>
            ))}
          </Box>
        ) : (
          <GuidedEmptyState
            kind="empty"
            title={
              search.trim() || state !== 'ALL'
                ? t('laterPage.noMatchesTitle')
                : t('saved.emptyTitle')
            }
            description={
              search.trim() || state !== 'ALL'
                ? t('laterPage.noMatchesDescription')
                : t('saved.emptyDescription')
            }
          />
        )}

        {(hasPrevious || hasNext) && (
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
            <ActionButton
              intent="quiet"
              disabled={!hasPrevious}
              onClick={() => updateUrl({ page: String(page - 1) })}
            >
              {t('saved.previous')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              disabled={!hasNext}
              onClick={() => updateUrl({ page: String(page + 1) })}
            >
              {t('saved.next')}
            </ActionButton>
          </Stack>
        )}
      </Box>

      <ContentDialog
        open={Boolean(snoozeItem)}
        title={t('laterPage.snoozeDialog.title')}
        description={t('laterPage.snoozeDialog.description')}
        closeLabel={t('actions.close')}
        onClose={() => setSnoozeItem(null)}
        busy={updateMutation.isPending}
        maxWidth="xs"
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!snoozeItem || snoozeResolution.kind !== 'valid' || snoozeInvalid) return;
            updateState(snoozeItem, 'SNOOZED', snoozeResolution.scheduledFor);
          }}
        >
          <Stack spacing={2}>
            <FormField
              autoFocus
              required
              type="datetime-local"
              label={t('laterPage.snoozeDialog.timeLabel')}
              value={snoozeValue}
              disabled={updateMutation.isPending}
              inputProps={{ min: localDateTimeValue(new Date(Date.now() + 60_000)) }}
              errorMessage={snoozeError}
              supportingText={t('laterPage.snoozeDialog.timeZone', {
                timeZone: snoozeTimeZone,
              })}
              onChange={(event) => setSnoozeValue(event.target.value)}
            />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <ActionButton
                intent="quiet"
                disabled={updateMutation.isPending}
                onClick={() => setSnoozeItem(null)}
              >
                {t('actions.cancel')}
              </ActionButton>
              <ActionButton
                type="submit"
                intent="primary"
                loading={updateMutation.isPending}
                loadingLabel={t('actions.saving')}
                disabled={snoozeInvalid}
              >
                {t('laterPage.snoozeDialog.confirm')}
              </ActionButton>
            </Stack>
          </Stack>
        </Box>
      </ContentDialog>
    </PageCanvas>
  );
}
