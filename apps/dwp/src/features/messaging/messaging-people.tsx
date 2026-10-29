import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, Search, X } from 'lucide-react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createDirectMessagingConversation,
  getMessagingPeoplePage,
} from '@dwp-frontend/shared-utils/api/messaging-api';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';
import { ActionButton, FormField, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MessagingPageHeading, MessagingPersonLine } from './messaging-components';
import {
  canLoadNextMessagingPeoplePage,
  collectMessagingPeople,
  filterMessagingPeoplePresence,
  hasMessagingPeopleFilters,
  mergeMessagingPeopleFilters,
  nextMessagingPeoplePageParam,
  readMessagingPeopleFilters,
} from './messaging-people-model';
import { maskMessagingPresence, useBrowserOnlineState } from './messaging-presence-freshness';

import type { MessagingPeopleFilters } from './messaging-people-model';
import type { MessagingPeoplePresenceFilter } from '@dwp-frontend/shared-utils/api/messaging-api';

const PEOPLE_PAGE_SIZE = 30;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

export function MessagingPeople() {
  const { t } = useTranslation('messaging');
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readMessagingPeopleFilters(params), [params]);
  const requestFilters = useDebouncedValue(filters, 220);
  const browserOnline = useBrowserOnlineState();
  const query = useInfiniteQuery({
    queryKey: [
      'messaging',
      'people-page',
      requestFilters.query,
      requestFilters.organization,
      requestFilters.jobTitle,
      requestFilters.presence,
    ],
    queryFn: ({ pageParam, signal }) =>
      getMessagingPeoplePage({
        query: requestFilters.query.trim(),
        organization: requestFilters.organization.trim(),
        jobTitle: requestFilters.jobTitle.trim(),
        presence: requestFilters.presence,
        cursor: pageParam ?? undefined,
        limit: PEOPLE_PAGE_SIZE,
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: nextMessagingPeoplePageParam,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: 1,
  });
  const serverPeople = collectMessagingPeople(query.data?.pages ?? []);
  const people = filterMessagingPeoplePresence(
    maskMessagingPresence(serverPeople, browserOnline),
    filters.presence
  );
  const directoryTotal = query.data?.pages[0]?.total ?? 0;
  const presenceUnavailable =
    !browserOnline ||
    Boolean(query.data?.pages.some((page) => page.presence.authority === 'UNAVAILABLE'));
  const canLoadNextPage = canLoadNextMessagingPeoplePage({
    hasNextPage: Boolean(query.hasNextPage),
    isFetching: query.isFetching,
  });
  const directMutation = useMutation({
    mutationFn: createDirectMessagingConversation,
    onSuccess: (conversation) => {
      navigate(`/messages/direct?conversation=${conversation.conversationId}`);
    },
    onError: () => toast.error(t('people.openError')),
  });

  const updateFilters = (patch: Partial<MessagingPeopleFilters>) => {
    setParams(mergeMessagingPeopleFilters(params, patch), { replace: true });
  };
  const resultSummary =
    filters.presence === 'ALL'
      ? t('people.results.all', { loaded: people.length, total: directoryTotal })
      : t('people.results.filtered', { loaded: people.length, total: directoryTotal });

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('people.eyebrow')}
        title={t('people.title')}
        description={t('people.description')}
      />

      <Box sx={{ maxWidth: 1040 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(240px, 1.7fr) repeat(3, minmax(150px, 1fr))',
            },
            gap: 1.25,
          }}
        >
          <FormField
            size="small"
            label={t('people.filters.search')}
            value={filters.query}
            placeholder={t('people.search')}
            onChange={(event) => updateFilters({ query: event.target.value })}
            slotProps={{
              htmlInput: { 'aria-label': t('people.filters.search') },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormField
            size="small"
            label={t('people.filters.organization')}
            value={filters.organization}
            onChange={(event) => updateFilters({ organization: event.target.value })}
            slotProps={{
              htmlInput: { 'aria-label': t('people.filters.organization') },
            }}
          />
          <FormField
            size="small"
            label={t('people.filters.jobTitle')}
            value={filters.jobTitle}
            onChange={(event) => updateFilters({ jobTitle: event.target.value })}
            slotProps={{
              htmlInput: { 'aria-label': t('people.filters.jobTitle') },
            }}
          />
          <FormField
            select
            size="small"
            label={t('people.filters.presence')}
            value={filters.presence}
            onChange={(event) =>
              updateFilters({
                presence: event.target.value as MessagingPeoplePresenceFilter,
              })
            }
          >
            {(['ALL', 'AVAILABLE', 'OFFLINE', 'UNKNOWN'] as const).map((state) => (
              <MenuItem key={state} value={state}>
                {t(`people.filters.presenceOptions.${state}`)}
              </MenuItem>
            ))}
          </FormField>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={0.75}
          sx={{ mt: 1.5 }}
        >
          <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
            {query.data ? resultSummary : t('people.results.loading')}
          </Typography>
          {hasMessagingPeopleFilters(filters) && (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<X size={15} aria-hidden="true" />}
              onClick={() =>
                updateFilters({ query: '', organization: '', jobTitle: '', presence: 'ALL' })
              }
            >
              {t('people.filters.clear')}
            </ActionButton>
          )}
        </Stack>

        {presenceUnavailable && query.data && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t('people.presenceUnavailable')}
          </Alert>
        )}

        <Box
          data-testid="messaging-people-directory"
          sx={{
            mt: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            overflow: 'hidden',
          }}
        >
          {query.isRefetchError && !query.isFetchNextPageError && query.data && (
            <Alert
              severity="warning"
              sx={{ m: 2 }}
              action={
                <ActionButton intent="quiet" size="small" onClick={() => void query.refetch()}>
                  {t('people.retry')}
                </ActionButton>
              }
            >
              {t('people.refreshError')}
            </Alert>
          )}
          {query.isPending ? (
            <Stack spacing={1} sx={{ p: 2 }} aria-label={t('people.loading')}>
              {[0, 1, 2, 3, 4].map((item) => (
                <Skeleton key={item} variant="rounded" height={56} />
              ))}
            </Stack>
          ) : query.isError && !query.data ? (
            <Alert
              severity="error"
              sx={{ m: 2 }}
              action={
                <ActionButton intent="quiet" size="small" onClick={() => void query.refetch()}>
                  {t('people.retry')}
                </ActionButton>
              }
            >
              {t('people.loadError')}
            </Alert>
          ) : people.length ? (
            <Stack role="list" divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {people.map((person) => (
                <Box
                  key={person.userId}
                  role="listitem"
                  sx={{
                    px: 2,
                    py: 1.4,
                    contentVisibility: 'auto',
                    containIntrinsicSize: 'auto 76px',
                  }}
                >
                  <MessagingPersonLine
                    person={person}
                    action={
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<MessageSquarePlus size={15} aria-hidden="true" />}
                        loading={
                          directMutation.isPending && directMutation.variables === person.userId
                        }
                        loadingLabel={t('people.openingPerson', { name: person.displayName })}
                        disabled={directMutation.isPending}
                        aria-label={t('people.messagePerson', { name: person.displayName })}
                        onClick={() => directMutation.mutate(person.userId)}
                      >
                        {t('people.message')}
                      </ActionButton>
                    }
                  />
                </Box>
              ))}
            </Stack>
          ) : (
            <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center', p: 2 }}>
              <GuidedEmptyState
                kind={hasMessagingPeopleFilters(filters) ? 'no-results' : 'empty'}
                title={t('people.emptyTitle')}
                description={
                  query.hasNextPage
                    ? t('people.pageEmptyDescription')
                    : t('people.emptyDescription')
                }
              />
            </Box>
          )}

          {query.isFetchNextPageError && (
            <Alert severity="error" sx={{ m: 2 }}>
              {t('people.loadMoreError')}
            </Alert>
          )}
          {query.hasNextPage && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 1.5,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <ActionButton
                intent="secondary"
                loading={query.isFetchingNextPage}
                loadingLabel={t('people.loadingMore')}
                disabled={!canLoadNextPage && !query.isFetchingNextPage}
                onClick={() => {
                  if (canLoadNextPage) void query.fetchNextPage();
                }}
              >
                {query.isFetchNextPageError ? t('people.retry') : t('people.loadMore')}
              </ActionButton>
            </Box>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t('people.directoryNote')}
        </Typography>
      </Box>
    </PageCanvas>
  );
}
