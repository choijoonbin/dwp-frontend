import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarSearch, MapPin, Search, UserRound } from 'lucide-react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ContentDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { searchCalendarEventsV2 } from '@dwp-frontend/shared-utils/api/calendar-event-search-api';
import { useAuth } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { calendarDate, calendarTime } from './calendar-components';
import {
  calendarEventSearchResultKey,
  calendarEventSearchResults,
  validateCalendarEventSearchQuery,
} from './calendar-event-search-model';
import { retryRecoverableCalendarRead } from './calendar-read-source-state';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

const SEARCH_QUERY_PREFIX = ['calendar', 'event-search'] as const;

export function CalendarEventSearchResultList({
  events,
  language,
  onSelect,
}: Readonly<{
  events: readonly CalendarEvent[];
  language: string;
  onSelect: (event: CalendarEvent) => void;
}>) {
  const { t } = useTranslation('calendar');
  return (
    <Stack component="ul" spacing={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
      {events.map((event) => (
        <Box component="li" key={calendarEventSearchResultKey(event)}>
          <ButtonBase
            onClick={() => onSelect(event)}
            aria-label={t('eventSearch.resultLabel', {
              title: event.title,
              date: calendarDate(event.startsAt, language),
              time: calendarTime(event.startsAt, language),
              calendar: event.calendarName,
            })}
            sx={{
              width: 1,
              justifyContent: 'flex-start',
              textAlign: 'left',
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.radius.control + 'px',
              p: 1.5,
              '&:hover, &:focus-visible': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            <Stack spacing={0.65} sx={{ minWidth: 0, width: 1 }}>
              <Stack direction="row" justifyContent="space-between" gap={1} alignItems="start">
                <Typography fontWeight={foundationTokens.home.typography.weightBold} noWrap>
                  {event.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {calendarDate(event.startsAt, language)} ·{' '}
                  {calendarTime(event.startsAt, language)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {event.calendarName}
              </Typography>
              {(event.organizerName || event.location) && (
                <Stack direction="row" gap={1.5} flexWrap="wrap" useFlexGap>
                  {event.organizerName ? (
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <UserRound size={14} aria-hidden="true" />
                      <Typography variant="caption">{event.organizerName}</Typography>
                    </Stack>
                  ) : null}
                  {event.location ? (
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <MapPin size={14} aria-hidden="true" />
                      <Typography variant="caption">{event.location}</Typography>
                    </Stack>
                  ) : null}
                </Stack>
              )}
            </Stack>
          </ButtonBase>
        </Box>
      ))}
    </Stack>
  );
}

export function CalendarEventSearchDialog({
  open,
  from,
  to,
  timeZone,
  onClose,
  onSelect,
}: Readonly<{
  open: boolean;
  from: string;
  to: string;
  timeZone: string;
  onClose: () => void;
  onSelect: (event: CalendarEvent) => void;
}>) {
  const { t, i18n } = useTranslation('calendar');
  const auth = useAuth();
  const queryClient = useQueryClient();
  const fullScreen = useMediaQuery('(max-width:767.95px)', { noSsr: true });
  const [draftQuery, setDraftQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [searchRevision, setSearchRevision] = useState(0);
  const [validationVisible, setValidationVisible] = useState(false);
  const validation = useMemo(() => validateCalendarEventSearchQuery(draftQuery), [draftQuery]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}:${auth.user?.personPublicId ?? 'anonymous'}`;
  const searchQueryKey = [
    ...SEARCH_QUERY_PREFIX,
    identityKey,
    language,
    searchRevision,
    from,
    to,
    timeZone,
  ] as const;
  const searchQuery = useInfiniteQuery({
    queryKey: searchQueryKey,
    queryFn: ({ pageParam, signal }) =>
      searchCalendarEventsV2(
        {
          query: submittedQuery!,
          from,
          to,
          timeZone,
          limit: 50,
          cursor: pageParam,
        },
        signal
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    enabled: open && Boolean(auth.user && submittedQuery),
    staleTime: 0,
    gcTime: 0,
    retry: retryRecoverableCalendarRead,
  });
  const failed = searchQuery.isError || searchQuery.isFetchNextPageError;
  const results = calendarEventSearchResults(searchQuery.data?.pages, failed);

  const close = () => {
    void queryClient.cancelQueries({ queryKey: SEARCH_QUERY_PREFIX });
    queryClient.removeQueries({ queryKey: SEARCH_QUERY_PREFIX });
    setDraftQuery('');
    setSubmittedQuery(null);
    setSearchRevision(0);
    setValidationVisible(false);
    onClose();
  };
  const submit = () => {
    if (!validation.valid) {
      setValidationVisible(true);
      return;
    }
    queryClient.removeQueries({ queryKey: SEARCH_QUERY_PREFIX });
    setValidationVisible(false);
    setSubmittedQuery(validation.query);
    setSearchRevision((current) => current + 1);
  };

  return (
    <ContentDialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      maxWidth="sm"
      title={t('eventSearch.title')}
      closeLabel={t('actions.close')}
      titleStart={<CalendarSearch size={20} aria-hidden="true" />}
      contentDividers
      footerContent={
        <ActionButton intent="quiet" onClick={close}>
          {t('actions.close')}
        </ActionButton>
      }
    >
      <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
        {t('eventSearch.description')}
      </Typography>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="start">
          <FormField
            autoFocus
            fullWidth
            label={t('eventSearch.queryLabel')}
            placeholder={t('eventSearch.queryPlaceholder')}
            value={draftQuery}
            onChange={(event) => {
              setDraftQuery(event.target.value);
              setValidationVisible(false);
            }}
            inputProps={{ maxLength: 240 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
            errorMessage={
              validationVisible && !validation.valid
                ? t(`eventSearch.validation.${validation.reason}`)
                : undefined
            }
          />
          <ActionButton intent="primary" type="submit" sx={{ mt: { sm: 3.25 } }}>
            {t('eventSearch.submit')}
          </ActionButton>
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      {searchQuery.isPending && submittedQuery ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <LoadingState embedded label={t('eventSearch.loading')} />
        </Box>
      ) : failed ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void searchQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('eventSearch.loadError')}
        </InlineFeedback>
      ) : searchQuery.isSuccess && results.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography fontWeight={foundationTokens.home.typography.weightBold}>
            {t('eventSearch.emptyTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('eventSearch.emptyDescription')}
          </Typography>
        </Box>
      ) : results.length > 0 ? (
        <Stack spacing={1.25}>
          <Typography role="status" variant="caption" color="text.secondary">
            {t('eventSearch.resultCount', { count: results.length })}
          </Typography>
          <CalendarEventSearchResultList
            events={results}
            language={language}
            onSelect={(event) => {
              onSelect(event);
              close();
            }}
          />
          {searchQuery.hasNextPage ? (
            <ActionButton
              intent="secondary"
              disabled={searchQuery.isFetchingNextPage}
              onClick={() => void searchQuery.fetchNextPage()}
            >
              {t(
                searchQuery.isFetchingNextPage ? 'eventSearch.loadingMore' : 'eventSearch.loadMore'
              )}
            </ActionButton>
          ) : null}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2" sx={{ py: 3, textAlign: 'center' }}>
          {t('eventSearch.idle')}
        </Typography>
      )}
    </ContentDialog>
  );
}
